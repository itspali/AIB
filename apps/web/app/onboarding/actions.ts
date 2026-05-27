"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { STANDARD_COA_TEMPLATE } from "@/lib/onboarding/coa-template";
import type {
  ChannelFormValues,
  CorporateProfileFormValues,
  OnboardingDraft,
  TaxRateRow,
} from "@/lib/onboarding/types";

async function requireTenantId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  const tenantId = user.app_metadata?.tenant_id as string | undefined;
  if (!tenantId) throw new Error("Tenant context missing from session");
  return { supabase, tenantId };
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

  const rows = STANDARD_COA_TEMPLATE.map((a) => ({
    tenant_id: tenantId,
    ...a,
  }));

  const { error } = await supabase.from("accounts").insert(rows);
  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  return { success: true as const, count: rows.length };
}

export async function saveTaxRates(rows: TaxRateRow[]) {
  const { supabase, tenantId } = await requireTenantId();

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

  revalidatePath("/onboarding");
  return { success: true as const };
}

export async function saveChannel(values: ChannelFormValues) {
  const { supabase, tenantId } = await requireTenantId();

  let returnPolicyId = values.return_policy_id;

  if (!returnPolicyId && values.new_policy_name) {
    const { data: policy, error: policyError } = await supabase
      .from("return_policies")
      .insert({
        tenant_id: tenantId,
        policy_name: values.new_policy_name,
        return_window_days: parseInt(values.return_window_days || "30", 10),
      })
      .select("id")
      .single();

    if (policyError) return { error: policyError.message };
    returnPolicyId = policy.id;
  }

  const { error } = await supabase.from("storefront_channels").insert({
    tenant_id: tenantId,
    name: values.name,
    slug: values.slug,
    channel_type: values.channel_type,
    domain_url: values.domain_url || null,
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
  revalidatePath("/onboarding");
  return { success: true as const };
}

export async function completeOnboarding() {
  const { supabase, tenantId } = await requireTenantId();

  const { error } = await supabase
    .from("tenants")
    .update({ onboarding_status: "GO_LIVE_READY" })
    .eq("id", tenantId);

  if (error) return { error: error.message };

  revalidatePath("/onboarding");
  revalidatePath("/");
  revalidatePath("/dashboard");
  return { success: true as const };
}
