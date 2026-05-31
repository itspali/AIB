"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import type { TaxRateSlabInput } from "@/lib/dashboard/types";

export async function addTaxRateSlab(input: TaxRateSlabInput) {
  const name = input.tax_component_name?.trim();
  if (!name) return { error: "Component name is required" };

  const { supabase, tenantId } = await requireTenantId();

  const { error } = await supabase.from("tax_rate_registry").insert({
    tenant_id: tenantId,
    tax_component_name: name,
    tax_percentage: Number.parseFloat(input.tax_percentage) || 0,
    active_from_date: new Date(input.active_from_date).toISOString(),
    active_to_date: input.active_to_date ? new Date(input.active_to_date).toISOString() : null,
    legal_compliance_code: input.legal_compliance_code?.trim() || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function dismissGettingStarted() {
  const { supabase, tenantId } = await requireTenantId();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("metadata_json")
    .eq("id", tenantId)
    .single();

  const metadata = (tenant?.metadata_json as Record<string, unknown> | null) ?? {};

  const { error } = await supabase
    .from("tenants")
    .update({
      metadata_json: {
        ...metadata,
        getting_started_dismissed: true,
        getting_started_dismissed_at: new Date().toISOString(),
      },
    })
    .eq("id", tenantId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function markOrgSettingsReviewed() {
  const { supabase, tenantId } = await requireTenantId();

  const { data: tenant } = await supabase
    .from("tenants")
    .select("metadata_json")
    .eq("id", tenantId)
    .single();

  const metadata = (tenant?.metadata_json as Record<string, unknown> | null) ?? {};

  const { error } = await supabase
    .from("tenants")
    .update({
      metadata_json: {
        ...metadata,
        getting_started_org_reviewed: true,
      },
    })
    .eq("id", tenantId);

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  revalidatePath("/settings/organization");
  return { success: true as const };
}
