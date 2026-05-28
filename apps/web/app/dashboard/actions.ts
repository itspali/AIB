"use server";

import { revalidatePath } from "next/cache";
import { requireTenantId } from "@/lib/supabase/require-tenant";
import type { TaxRateSlabInput } from "@/lib/dashboard/types";

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
