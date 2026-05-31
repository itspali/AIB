"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { coaTemplateForCountry } from "@/lib/onboarding/locale-presets";
import { requireTenantId } from "@/lib/supabase/require-tenant";
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
    .select("metadata_json")
    .eq("id", tenantId)
    .single();

  const metadata = (tenant?.metadata_json as Record<string, unknown> | null) ?? {};
  const draft = metadata.onboarding_draft as OnboardingDraft | undefined;
  const fromDraft = draft?.corporateProfile?.country_code || draft?.location?.country_code;
  if (fromDraft) return fromDraft.toUpperCase();

  const { data: location } = await supabase
    .from("tenant_locations")
    .select("country_code")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (location?.country_code) return String(location.country_code).toUpperCase();
  return "US";
}

async function updateOnboardingStatus(
  supabase: SupabaseClient,
  tenantId: string,
  status: TenantOnboardingStatus
) {
  await supabase.from("tenants").update({ onboarding_status: status }).eq("id", tenantId);
}

export async function saveCorporateProfile(values: CorporateProfileFormValues) {
  const { supabase } = await requireTenantId();

  const { error } = await supabase.rpc("save_onboarding_corporate_profile", {
    p_company_name: values.company_name,
    p_legal_registration_number: values.legal_registration_number,
    p_tax_identifier: values.tax_identifier,
    p_location_name: values.name,
    p_location_code: values.code,
    p_address_line1: values.address_line1,
    p_city: values.city,
    p_state: values.state,
    p_zip_postal: values.zip_postal,
    p_country_code: values.country_code,
    p_billing_state: values.billing_state || null,
    p_shipping_state: values.shipping_state || null,
    p_tax_registered_name: values.tax_registered_name || null,
    p_location_tax_identifier: values.location_tax_identifier || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  return { success: true as const };
}

/** @deprecated Use saveCorporateProfile */
export async function saveLocation(values: CorporateProfileFormValues) {
  return saveCorporateProfile(values);
}

export async function deployCoaTemplate() {
  const { supabase, tenantId } = await requireTenantId();

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

export async function saveTaxRates(rows: TaxRateRow[]) {
  const { supabase, tenantId } = await requireTenantId();

  const { count, error: countError } = await supabase
    .from("tax_rate_registry")
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
    .map((r) => ({
      tenant_id: tenantId,
      tax_component_name: r.tax_component_name.trim(),
      tax_percentage: parseFloat(r.tax_percentage) || 0,
      active_from_date: new Date(r.active_from_date).toISOString(),
      active_to_date: r.active_to_date ? new Date(r.active_to_date).toISOString() : null,
      legal_compliance_code: r.legal_compliance_code || null,
    }));

  if (payload.length === 0) return { error: "Add at least one tax component" };

  const { error } = await supabase.from("tax_rate_registry").insert(payload);
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

  const { supabase, tenantId } = await requireTenantId();
  const data = parsed.data;

  const { count, error: countError } = await supabase
    .from("storefront_channels")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (countError) return { error: countError.message };
  if ((count ?? 0) > 0) {
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

export async function saveDraft(draft: OnboardingDraft) {
  const { supabase, tenantId } = await requireTenantId();

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
  const { supabase } = await requireTenantId();

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

  revalidatePath("/onboarding");
  revalidatePath("/");
  revalidatePath("/dashboard");
  return { success: true as const };
}
