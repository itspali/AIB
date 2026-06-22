"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  getDefaultChannelConfigs,
  parseBusinessModel,
  type BusinessModel,
} from "@/lib/onboarding/business-model";
import { resolveOnboardingCountryCode } from "@/lib/onboarding/resolve-country";
import {
  coaTemplateForCountry,
  defaultTaxRatesForCountry,
} from "@/lib/onboarding/locale-presets";
import { isFinanceSetupComplete } from "@/lib/onboarding/finance-setup-gate";
import { requireTenantMutation } from "@/lib/supabase/require-tenant";
import type {
  ChannelFormValues,
  CorporateProfileFormValues,
  OnboardingDraft,
  TaxRateRow,
} from "@/lib/onboarding/types";

const channelSchema = z.object({
  name: z.string().trim().min(1, "Channel name is required"),
  slug: z
    .string()
    .trim()
    .min(1, "Slug is required")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens"),
  channel_type: z.string().min(1, "Channel type is required"),
  domain_url: z.string().optional(),
  return_policy_id: z.string().optional(),
  new_policy_name: z.string().optional(),
  return_window_days: z.string().optional(),
});

type TenantOnboardingStatus =
  | "ACCOUNT_CREATED"
  | "ORGANIZATION_CONFIGURED"
  | "DATABASE_SEEDED"
  | "COMPLIANCE_VERIFIED"
  | "GO_LIVE_READY";

async function resolveTenantCountryCode(
  supabase: SupabaseClient,
  tenantId: string
): Promise<string> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("country_code, metadata_json")
    .eq("id", tenantId)
    .single();

  const metadata = (tenant?.metadata_json as Record<string, unknown> | null) ?? {};
  const draft = metadata.onboarding_draft as OnboardingDraft | undefined;

  const { data: location } = await supabase
    .from("tenant_locations")
    .select("country_code")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  return resolveOnboardingCountryCode({
    draft,
    tenantCountryCode: tenant?.country_code,
    primaryLocationCountryCode: location?.country_code,
  });
}

async function updateOnboardingStatus(
  supabase: SupabaseClient,
  tenantId: string,
  status: TenantOnboardingStatus
) {
  await supabase.from("tenants").update({ onboarding_status: status }).eq("id", tenantId);
}

function normalizeCorporateProfile(values: CorporateProfileFormValues): CorporateProfileFormValues {
  const city = values.city.trim();
  return {
    ...values,
    company_name: values.company_name.trim(),
    legal_registration_number: values.legal_registration_number?.trim() ?? "",
    tax_identifier: values.tax_identifier?.trim() ?? "",
    name: values.name.trim(),
    code: values.code?.trim() || "MAIN",
    address_line1: values.address_line1?.trim() || city || "—",
    address_line2: values.address_line2?.trim() ?? "",
    city,
    state: values.state.trim(),
    zip_postal: values.zip_postal?.trim() || "00000",
    country_code: values.country_code.toUpperCase(),
    billing_state: values.billing_state?.trim() ?? "",
    shipping_state: values.shipping_state?.trim() ?? "",
    tax_registered_name: values.tax_registered_name?.trim() ?? "",
    location_tax_identifier: values.location_tax_identifier?.trim() ?? "",
  };
}

export async function assertFinanceSetupReady(
  supabase: SupabaseClient,
  tenantId: string
): Promise<{ error?: string }> {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("onboarding_status")
    .eq("id", tenantId)
    .single();

  if (!isFinanceSetupComplete(tenant?.onboarding_status)) {
    return {
      error:
        "Complete finance setup in onboarding before creating purchase orders or invoices.",
    };
  }

  return {};
}

export async function saveCorporateProfile(values: CorporateProfileFormValues) {
  const { supabase, tenantId } = await requireTenantMutation();
  let normalized = normalizeCorporateProfile(values);

  if (values.tax_registration_status && values.tax_registration_status !== "REGISTERED") {
    normalized = { ...normalized, tax_identifier: "" };
  }

  const { error } = await supabase.rpc("save_onboarding_corporate_profile", {
    p_company_name: normalized.company_name,
    p_legal_registration_number: normalized.legal_registration_number,
    p_tax_identifier: normalized.tax_identifier,
    p_location_name: normalized.name,
    p_location_code: normalized.code,
    p_address_line1: normalized.address_line1,
    p_address_line2: normalized.address_line2 || null,
    p_city: normalized.city,
    p_state: normalized.state,
    p_zip_postal: normalized.zip_postal,
    p_country_code: normalized.country_code,
    p_billing_state: normalized.billing_state || null,
    p_shipping_state: normalized.shipping_state || null,
    p_tax_registered_name: normalized.tax_registered_name || null,
    p_location_tax_identifier: normalized.location_tax_identifier || null,
  });

  if (error) return { error: error.message };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("metadata_json")
    .eq("id", tenantId)
    .single();

  const metadata = (tenant?.metadata_json as Record<string, unknown> | null) ?? {};
  const draft = (metadata.onboarding_draft as OnboardingDraft | undefined) ?? {};

  const { error: metadataError } = await supabase
    .from("tenants")
    .update({
      country_code: normalized.country_code,
      metadata_json: {
        ...metadata,
        onboarding_draft: {
          ...draft,
          tax_registration_status: values.tax_registration_status,
          corporateProfile: {
            ...(draft.corporateProfile ?? {}),
            company_name: normalized.company_name,
            country_code: normalized.country_code,
            name: normalized.name,
            code: normalized.code,
            address_line1: normalized.address_line1,
            address_line2: normalized.address_line2,
            city: normalized.city,
            state: normalized.state,
            zip_postal: normalized.zip_postal,
            tax_identifier: normalized.tax_identifier,
            legal_registration_number: normalized.legal_registration_number,
            tax_registration_status: values.tax_registration_status,
          },
        },
      },
    })
    .eq("id", tenantId);

  if (metadataError) return { error: metadataError.message };

  revalidatePath("/onboarding");
  return { success: true as const };
}

/** @deprecated Use saveCorporateProfile */
export async function saveLocation(values: CorporateProfileFormValues) {
  return saveCorporateProfile(values);
}

export async function deployCoaTemplate() {
  const { supabase, tenantId } = await requireTenantMutation();

  // Seed a starter set of units of measure so the item catalog has units to
  // pick from out of the box. Idempotent and best-effort — never blocks the
  // chart-of-accounts deployment.
  await supabase.rpc("seed_default_uoms");

  const { count, error: countError } = await supabase
    .from("accounts")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (countError) return { error: countError.message };
  if ((count ?? 0) > 0) {
    await updateOnboardingStatus(supabase, tenantId, "DATABASE_SEEDED");
    revalidatePath("/onboarding");
    return { success: true as const, count: count ?? 0, alreadyDeployed: true as const };
  }

  const countryCode = await resolveTenantCountryCode(supabase, tenantId);
  const { template } = coaTemplateForCountry(countryCode);

  const rows = template.map((a) => ({
    tenant_id: tenantId,
    ...a,
  }));

  const { error } = await supabase.from("accounts").insert(rows);
  if (error) return { error: error.message };

  await updateOnboardingStatus(supabase, tenantId, "DATABASE_SEEDED");
  revalidatePath("/onboarding");
  return { success: true as const, count: rows.length };
}

function toTaxCodeSlug(value: string): string {
  const slug = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 18);
  return slug || "TAX";
}

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export async function saveTaxRates(rows: TaxRateRow[]) {
  const { supabase, tenantId } = await requireTenantMutation();

  const { count, error: countError } = await supabase
    .from("tax_codes")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (countError) return { error: countError.message };
  if ((count ?? 0) > 0) {
    await updateOnboardingStatus(supabase, tenantId, "COMPLIANCE_VERIFIED");
    revalidatePath("/onboarding");
    return { success: true as const, alreadySaved: true as const };
  }

  const payload = rows
    .filter((r) => r.tax_component_name.trim())
    .map((r) => {
      const pct = parseFloat(r.tax_percentage) || 0;
      return {
        tenant_id: tenantId,
        code: `${toTaxCodeSlug(r.tax_component_name)}-${crypto.randomUUID().slice(0, 6)}`,
        name: r.tax_component_name.trim(),
        kind: pct === 0 ? "ZERO" : "GST",
        rate: pct,
        is_inclusive_default: false,
        is_variable: false,
        effective_from: toDateOnly(r.active_from_date),
        effective_to: toDateOnly(r.active_to_date),
        is_active: true,
      };
    });

  if (payload.length === 0) return { error: "Add at least one tax component" };

  const { error } = await supabase.from("tax_codes").insert(payload);
  if (error) return { error: error.message };

  await updateOnboardingStatus(supabase, tenantId, "COMPLIANCE_VERIFIED");
  revalidatePath("/onboarding");
  return { success: true as const };
}

export async function saveChannel(values: ChannelFormValues) {
  const parsed = channelSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid channel details" };
  }

  const { supabase, tenantId } = await requireTenantMutation();
  return ensureChannel(supabase, tenantId, parsed.data);
}

async function ensureChannel(
  supabase: SupabaseClient,
  tenantId: string,
  data: z.infer<typeof channelSchema>
) {
  const { data: existing } = await supabase
    .from("storefront_channels")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("slug", data.slug)
    .maybeSingle();

  if (existing) {
    revalidatePath("/onboarding");
    return { success: true as const, alreadySaved: true as const };
  }

  let returnPolicyId = data.return_policy_id;

  if (!returnPolicyId && !data.new_policy_name?.trim()) {
    return { error: "Add a return policy name or select an existing policy" };
  }

  if (!returnPolicyId && data.new_policy_name) {
    const { data: policy, error: policyError } = await supabase
      .from("return_policies")
      .insert({
        tenant_id: tenantId,
        policy_name: data.new_policy_name.trim(),
        return_window_days: parseInt(data.return_window_days || "30", 10),
      })
      .select("id")
      .single();

    if (policyError) return { error: policyError.message };
    returnPolicyId = policy.id;
  }

  const { error } = await supabase.from("storefront_channels").insert({
    tenant_id: tenantId,
    name: data.name,
    slug: data.slug,
    channel_type: data.channel_type,
    domain_url: data.domain_url || null,
    return_policy_id: returnPolicyId || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  return { success: true as const };
}

async function persistBusinessModel(
  supabase: SupabaseClient,
  tenantId: string,
  businessModel: BusinessModel
) {
  const { data: tenant } = await supabase
    .from("tenants")
    .select("metadata_json")
    .eq("id", tenantId)
    .single();

  const metadata = (tenant?.metadata_json as Record<string, unknown> | null) ?? {};
  const draft = (metadata.onboarding_draft as OnboardingDraft | undefined) ?? {};

  const { error } = await supabase
    .from("tenants")
    .update({
      metadata_json: {
        ...metadata,
        business_model: businessModel,
        onboarding_draft: { ...draft, business_model: businessModel },
      },
    })
    .eq("id", tenantId);

  if (error) return { error: error.message };
  return { success: true as const };
}

export async function applyRecommendedFinanceSetup(businessModelInput?: BusinessModel) {
  const { supabase, tenantId } = await requireTenantMutation();

  const businessModel = parseBusinessModel(businessModelInput);
  const persistResult = await persistBusinessModel(supabase, tenantId, businessModel);
  if (persistResult.error) return { error: persistResult.error };

  const coaResult = await deployCoaTemplate();
  if (coaResult.error) return { error: coaResult.error };

  const countryCode = await resolveTenantCountryCode(supabase, tenantId);
  const taxResult = await saveTaxRates(defaultTaxRatesForCountry(countryCode));
  if (taxResult.error) return { error: taxResult.error };

  const { data: tenant } = await supabase
    .from("tenants")
    .select("name")
    .eq("id", tenantId)
    .single();

  const brandName = tenant?.name ?? "";
  const channelConfigs = getDefaultChannelConfigs(businessModel, brandName);

  for (const config of channelConfigs) {
    const { key: _key, ...channelValues } = config;
    const channelResult = await ensureChannel(supabase, tenantId, channelValues);
    if (channelResult.error) return { error: channelResult.error };
  }

  return completeOnboarding();
}

export async function saveDraft(draft: OnboardingDraft) {
  const { supabase, tenantId } = await requireTenantMutation();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("metadata_json")
    .eq("id", tenantId)
    .single();

  const metadata = (tenant?.metadata_json as Record<string, unknown>) ?? {};

  const { error } = await supabase
    .from("tenants")
    .update({
      metadata_json: { ...metadata, onboarding_draft: draft },
    })
    .eq("id", tenantId);

  if (error) return { error: error.message };
  return { success: true as const };
}

export async function completeOnboarding() {
  const { supabase } = await requireTenantMutation();

  const { error } = await supabase.rpc("complete_onboarding");

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes("complete onboarding requires")) {
      return { error: error.message };
    }
    if (message.includes("function") && message.includes("does not exist")) {
      return {
        error:
          "Launch validation is unavailable. Deploy migration 20260544000000_onboarding_signup_improvements.sql, then retry.",
      };
    }
    return { error: error.message };
  }

  // Stamp the onboarded fast-path cookie now so the redirect to /dashboard and
  // the first navigations skip the middleware's onboarding DB check.
  const cookieStore = await cookies();
  cookieStore.set("aib-onboarded", "1", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });

  revalidatePath("/onboarding");
  revalidatePath("/");
  revalidatePath("/dashboard");
  return { success: true as const };
}
