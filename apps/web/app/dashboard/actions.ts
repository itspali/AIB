"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import type { TaxRateSlabInput } from "@/lib/dashboard/types";

async function upsertRegistryMetadata(
  registryKey: "SALES_SETTINGS" | "FINANCIAL_SETTINGS",
  patch: Record<string, unknown>
) {
  const { supabase, tenantId } = await requireTenantId();

  const { data: existing } = await supabase
    .from("workspace_control_registry")
    .select("id, configuration_metadata")
    .eq("tenant_id", tenantId)
    .eq("scope_level", "TENANT_GLOBAL")
    .eq("registry_key", registryKey)
    .is("target_reference_id", null)
    .maybeSingle();

  const mergedMetadata = {
    ...((existing?.configuration_metadata as Record<string, unknown>) ?? {}),
    ...patch,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("workspace_control_registry")
      .update({ configuration_metadata: mergedMetadata })
      .eq("id", existing.id)
      .eq("tenant_id", tenantId);

    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("workspace_control_registry").insert({
      tenant_id: tenantId,
      scope_level: "TENANT_GLOBAL",
      registry_key: registryKey,
      target_reference_id: null,
      configuration_metadata: mergedMetadata,
    });

    if (error) return { error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true as const };
}

export async function updateAllowLineItemDiscounts(enabled: boolean) {
  return upsertRegistryMetadata("SALES_SETTINGS", {
    allow_line_item_discounts: enabled,
  });
}

export async function updateAccountingPeriodClosingDate(date: string | null) {
  return upsertRegistryMetadata("FINANCIAL_SETTINGS", {
    accounting_period_closing_date: date ? new Date(date).toISOString() : null,
  });
}

export async function addTaxRateSlab(row: TaxRateSlabInput) {
  const { supabase, tenantId } = await requireTenantId();

  const name = row.tax_component_name.trim();
  if (!name) return { error: "Component name is required" };
  if (!row.active_from_date) return { error: "Active from date is required" };

  const { error } = await supabase.from("tax_rate_registry").insert({
    tenant_id: tenantId,
    tax_component_name: name,
    tax_percentage: parseFloat(row.tax_percentage) || 0,
    active_from_date: new Date(row.active_from_date).toISOString(),
    active_to_date: row.active_to_date ? new Date(row.active_to_date).toISOString() : null,
    legal_compliance_code: row.legal_compliance_code?.trim() || null,
  });

  if (error) return { error: error.message };

  revalidatePath("/dashboard");
  return { success: true as const };
}
