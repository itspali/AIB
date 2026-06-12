import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePoAutoRoundOffStep } from "@/lib/procurement/purchase-orders/po-auto-round-off";

export type LandedCostAllocationMethod = "BY_QUANTITY" | "BY_VALUE" | "BY_WEIGHT";

export type ProcurementSettings = {
  allow_edit_issued_purchase_orders: boolean;
  allow_line_item_discounts: boolean;
  allow_transaction_discounts: boolean;
  purchase_prices_tax_inclusive: boolean;
  po_mrp_trade_terms_enabled: boolean;
  po_auto_round_off_enabled: boolean;
  po_auto_round_off_step: number;
  is_po_mandatory_for_grn: boolean;
  is_qc_required_before_stocking: boolean;
  allow_zero_cost_receipts: boolean;
  promo_default_category: string;
  landed_cost_allocation_method: LandedCostAllocationMethod;
  absorb_sunk_logistics_overhead: boolean;
  matching_tolerance_percentage: number;
};

export type FinancialProcurementSettings = {
  ppv_expense_account_id: string | null;
  promo_contra_expense_account_id: string | null;
  git_holding_account_id: string | null;
  vendor_prepayment_account_id: string | null;
};

const DEFAULT_PROCUREMENT_SETTINGS: ProcurementSettings = {
  allow_edit_issued_purchase_orders: false,
  allow_line_item_discounts: false,
  allow_transaction_discounts: false,
  purchase_prices_tax_inclusive: false,
  po_mrp_trade_terms_enabled: true,
  po_auto_round_off_enabled: false,
  po_auto_round_off_step: 1,
  is_po_mandatory_for_grn: false,
  is_qc_required_before_stocking: false,
  allow_zero_cost_receipts: true,
  promo_default_category: "FREE_GOODS",
  landed_cost_allocation_method: "BY_VALUE",
  absorb_sunk_logistics_overhead: false,
  matching_tolerance_percentage: 2,
};

const DEFAULT_FINANCIAL_PROCUREMENT_SETTINGS: FinancialProcurementSettings = {
  ppv_expense_account_id: null,
  promo_contra_expense_account_id: null,
  git_holding_account_id: null,
  vendor_prepayment_account_id: null,
};

function readBoolean(
  meta: Record<string, unknown>,
  key: string,
  fallback: boolean
): boolean {
  return typeof meta[key] === "boolean" ? meta[key] : fallback;
}

function readString(meta: Record<string, unknown>, key: string, fallback: string): string {
  return typeof meta[key] === "string" && meta[key].trim() ? meta[key] : fallback;
}

function readNumber(meta: Record<string, unknown>, key: string, fallback: number): number {
  const value = meta[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function readAllocationMethod(
  meta: Record<string, unknown>,
  fallback: LandedCostAllocationMethod
): LandedCostAllocationMethod {
  const value = meta.landed_cost_allocation_method;
  if (value === "BY_QUANTITY" || value === "BY_VALUE" || value === "BY_WEIGHT") {
    return value;
  }
  return fallback;
}

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
    row?.configuration_metadata && typeof row.configuration_metadata === "object"
      ? (row.configuration_metadata as Record<string, unknown>)
      : {};

  const salesMeta =
    salesRow?.configuration_metadata && typeof salesRow.configuration_metadata === "object"
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
    allow_edit_issued_purchase_orders: readBoolean(
      meta,
      "allow_edit_issued_purchase_orders",
      DEFAULT_PROCUREMENT_SETTINGS.allow_edit_issued_purchase_orders
    ),
    allow_line_item_discounts: allowLineItemDiscounts,
    allow_transaction_discounts: allowTransactionDiscounts,
    purchase_prices_tax_inclusive: readBoolean(
      meta,
      "purchase_prices_tax_inclusive",
      DEFAULT_PROCUREMENT_SETTINGS.purchase_prices_tax_inclusive
    ),
    po_mrp_trade_terms_enabled: readBoolean(
      meta,
      "po_mrp_trade_terms_enabled",
      DEFAULT_PROCUREMENT_SETTINGS.po_mrp_trade_terms_enabled
    ),
    po_auto_round_off_enabled: readBoolean(
      meta,
      "po_auto_round_off_enabled",
      DEFAULT_PROCUREMENT_SETTINGS.po_auto_round_off_enabled
    ),
    po_auto_round_off_step: resolvePoAutoRoundOffStep(meta.po_auto_round_off_step),
    is_po_mandatory_for_grn: readBoolean(
      meta,
      "is_po_mandatory_for_grn",
      DEFAULT_PROCUREMENT_SETTINGS.is_po_mandatory_for_grn
    ),
    is_qc_required_before_stocking: readBoolean(
      meta,
      "is_qc_required_before_stocking",
      DEFAULT_PROCUREMENT_SETTINGS.is_qc_required_before_stocking
    ),
    allow_zero_cost_receipts: readBoolean(
      meta,
      "allow_zero_cost_receipts",
      DEFAULT_PROCUREMENT_SETTINGS.allow_zero_cost_receipts
    ),
    promo_default_category: readString(
      meta,
      "promo_default_category",
      DEFAULT_PROCUREMENT_SETTINGS.promo_default_category
    ),
    landed_cost_allocation_method: readAllocationMethod(
      meta,
      DEFAULT_PROCUREMENT_SETTINGS.landed_cost_allocation_method
    ),
    absorb_sunk_logistics_overhead: readBoolean(
      meta,
      "absorb_sunk_logistics_overhead",
      DEFAULT_PROCUREMENT_SETTINGS.absorb_sunk_logistics_overhead
    ),
    matching_tolerance_percentage: readNumber(
      meta,
      "matching_tolerance_percentage",
      DEFAULT_PROCUREMENT_SETTINGS.matching_tolerance_percentage
    ),
  };
}

export async function fetchFinancialProcurementSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<FinancialProcurementSettings> {
  const { data: row } = await supabase
    .from("workspace_control_registry")
    .select("configuration_metadata")
    .eq("tenant_id", tenantId)
    .eq("registry_key", "FINANCIAL_SETTINGS")
    .eq("scope_level", "TENANT_GLOBAL")
    .is("target_reference_id", null)
    .maybeSingle();

  const meta =
    row?.configuration_metadata && typeof row.configuration_metadata === "object"
      ? (row.configuration_metadata as Record<string, unknown>)
      : {};

  function readUuid(key: string): string | null {
    return typeof meta[key] === "string" && meta[key].trim() ? meta[key] : null;
  }

  return {
    ppv_expense_account_id: readUuid("ppv_expense_account_id"),
    promo_contra_expense_account_id: readUuid("promo_contra_expense_account_id"),
    git_holding_account_id: readUuid("git_holding_account_id"),
    vendor_prepayment_account_id: readUuid("vendor_prepayment_account_id"),
  };
}
