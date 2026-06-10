import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePoAutoRoundOffStep } from "@/lib/procurement/purchase-orders/po-auto-round-off";

export type ProcurementSettings = {
  allow_edit_issued_purchase_orders: boolean;
  allow_line_item_discounts: boolean;
  allow_transaction_discounts: boolean;
  purchase_prices_tax_inclusive: boolean;
  /** Show MRP + trade markdown stack under offer unit price when item MRP exists. */
  po_mrp_trade_terms_enabled: boolean;
  po_auto_round_off_enabled: boolean;
  po_auto_round_off_step: number;
};

const DEFAULT_PROCUREMENT_SETTINGS: ProcurementSettings = {
  allow_edit_issued_purchase_orders: false,
  allow_line_item_discounts: false,
  allow_transaction_discounts: false,
  purchase_prices_tax_inclusive: false,
  po_mrp_trade_terms_enabled: true,
  po_auto_round_off_enabled: false,
  po_auto_round_off_step: 1,
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

  const allowTransactionDiscounts =
    typeof meta.allow_transaction_discounts === "boolean"
      ? meta.allow_transaction_discounts
      : DEFAULT_PROCUREMENT_SETTINGS.allow_transaction_discounts;

  return {
    allow_edit_issued_purchase_orders:
      typeof meta.allow_edit_issued_purchase_orders === "boolean"
        ? meta.allow_edit_issued_purchase_orders
        : DEFAULT_PROCUREMENT_SETTINGS.allow_edit_issued_purchase_orders,
    allow_line_item_discounts: allowLineItemDiscounts,
    allow_transaction_discounts: allowTransactionDiscounts,
    purchase_prices_tax_inclusive:
      typeof meta.purchase_prices_tax_inclusive === "boolean"
        ? meta.purchase_prices_tax_inclusive
        : DEFAULT_PROCUREMENT_SETTINGS.purchase_prices_tax_inclusive,
    po_mrp_trade_terms_enabled:
      typeof meta.po_mrp_trade_terms_enabled === "boolean"
        ? meta.po_mrp_trade_terms_enabled
        : DEFAULT_PROCUREMENT_SETTINGS.po_mrp_trade_terms_enabled,
    po_auto_round_off_enabled:
      typeof meta.po_auto_round_off_enabled === "boolean"
        ? meta.po_auto_round_off_enabled
        : DEFAULT_PROCUREMENT_SETTINGS.po_auto_round_off_enabled,
    po_auto_round_off_step: resolvePoAutoRoundOffStep(meta.po_auto_round_off_step),
  };
}
