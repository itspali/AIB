import type { LandedCostAllocationMethod, ProcurementSettings } from "@/lib/procurement/settings";

export type PolicySnapshot = Pick<
  ProcurementSettings,
  | "is_po_mandatory_for_grn"
  | "is_qc_required_before_stocking"
  | "allow_zero_cost_receipts"
  | "po_mrp_trade_terms_enabled"
  | "landed_cost_allocation_method"
  | "matching_tolerance_percentage"
  | "po_auto_round_off_enabled"
>;

export type PolicyItem = {
  label: string;
  value: string;
  tone?: "positive" | "neutral" | "caution";
};

function allocationLabel(method: LandedCostAllocationMethod): string {
  switch (method) {
    case "BY_QUANTITY":
      return "By quantity";
    case "BY_VALUE":
      return "By value";
    case "BY_WEIGHT":
      return "By weight";
  }
}

export function buildProcurementPolicyItems(settings: PolicySnapshot): PolicyItem[] {
  return [
    {
      label: "PO required for GRN",
      value: settings.is_po_mandatory_for_grn ? "Required" : "Optional",
      tone: settings.is_po_mandatory_for_grn ? "positive" : "neutral",
    },
    {
      label: "QC before stocking",
      value: settings.is_qc_required_before_stocking ? "On" : "Off",
      tone: settings.is_qc_required_before_stocking ? "caution" : "neutral",
    },
    {
      label: "Zero-cost receipts",
      value: settings.allow_zero_cost_receipts ? "Allowed" : "Blocked",
      tone: settings.allow_zero_cost_receipts ? "positive" : "neutral",
    },
    {
      label: "MRP / trade terms on PO",
      value: settings.po_mrp_trade_terms_enabled ? "Enabled" : "Hidden",
      tone: settings.po_mrp_trade_terms_enabled ? "positive" : "neutral",
    },
    {
      label: "Landed cost allocation",
      value: allocationLabel(settings.landed_cost_allocation_method),
    },
    {
      label: "Three-way match tolerance",
      value: `${settings.matching_tolerance_percentage}%`,
    },
    {
      label: "PO auto round-off",
      value: settings.po_auto_round_off_enabled ? "On" : "Off",
      tone: settings.po_auto_round_off_enabled ? "positive" : "neutral",
    },
  ];
}

export function toneBadgeVariant(tone: PolicyItem["tone"] = "neutral") {
  switch (tone) {
    case "positive":
      return "completed" as const;
    case "caution":
      return "action_required" as const;
    default:
      return "locked" as const;
  }
}
