import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProcurementSettings = {
  allow_edit_issued_purchase_orders: boolean;
};

const DEFAULT_PROCUREMENT_SETTINGS: ProcurementSettings = {
  allow_edit_issued_purchase_orders: false,
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

  const meta =
    row?.configuration_metadata &&
    typeof row.configuration_metadata === "object"
      ? (row.configuration_metadata as Record<string, unknown>)
      : {};

  return {
    allow_edit_issued_purchase_orders:
      typeof meta.allow_edit_issued_purchase_orders === "boolean"
        ? meta.allow_edit_issued_purchase_orders
        : DEFAULT_PROCUREMENT_SETTINGS.allow_edit_issued_purchase_orders,
  };
}
