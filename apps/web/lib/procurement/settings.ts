import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProcurementSettings = {
  allow_edit_issued_purchase_orders: boolean;
  allow_line_item_discounts: boolean;
};

const DEFAULT_PROCUREMENT_SETTINGS: ProcurementSettings = {
  allow_edit_issued_purchase_orders: false,
  allow_line_item_discounts: false,
};

export async function fetchProcurementSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProcurementSettings> {
  const { data: row } = await supabase
    .from("workspace_control_registry")
    .select("configuration_metadata")
    .eq("tenant_id", tenantId)
    .eq("registry_key", "PROCUREMENT_SETTINGS")
    .eq("scope_level", "TENANT_GLOBAL")
    .is("target_reference_id", null)
    .maybeSingle();

  const { data: salesRow } = await supabase
    .from("workspace_control_registry")
    .select("configuration_metadata")
    .eq("tenant_id", tenantId)
    .eq("registry_key", "SALES_SETTINGS")
    .eq("scope_level", "TENANT_GLOBAL")
    .is("target_reference_id", null)
    .maybeSingle();

  const meta =
    row?.configuration_metadata &&
    typeof row.configuration_metadata === "object"
      ? (row.configuration_metadata as Record<string, unknown>)
      : {};

  const salesMeta =
    salesRow?.configuration_metadata &&
    typeof salesRow.configuration_metadata === "object"
      ? (salesRow.configuration_metadata as Record<string, unknown>)
      : {};

  const allowLineItemDiscounts =
    typeof meta.allow_line_item_discounts === "boolean"
      ? meta.allow_line_item_discounts
      : typeof salesMeta.allow_line_item_discounts === "boolean"
        ? salesMeta.allow_line_item_discounts
        : DEFAULT_PROCUREMENT_SETTINGS.allow_line_item_discounts;

  return {
    allow_edit_issued_purchase_orders:
      typeof meta.allow_edit_issued_purchase_orders === "boolean"
        ? meta.allow_edit_issued_purchase_orders
        : DEFAULT_PROCUREMENT_SETTINGS.allow_edit_issued_purchase_orders,
    allow_line_item_discounts: allowLineItemDiscounts,
  };
}
