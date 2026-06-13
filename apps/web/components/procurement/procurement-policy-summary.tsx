"use client";

import Link from "next/link";
import { Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LandedCostAllocationMethod, ProcurementSettings } from "@/lib/procurement/settings";
import { cn } from "@/lib/utils";

type PolicySnapshot = Pick<
  ProcurementSettings,
  | "is_po_mandatory_for_grn"
  | "is_qc_required_before_stocking"
  | "allow_zero_cost_receipts"
  | "po_mrp_trade_terms_enabled"
  | "landed_cost_allocation_method"
  | "matching_tolerance_percentage"
  | "po_auto_round_off_enabled"
>;

type Props = {
  settings: PolicySnapshot;
  className?: string;
};

type PolicyItem = {
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

function toneBadgeVariant(tone: PolicyItem["tone"] = "neutral") {
  switch (tone) {
    case "positive":
      return "completed" as const;
    case "caution":
      return "action_required" as const;
    default:
      return "locked" as const;
  }
}

function buildPolicyItems(settings: PolicySnapshot): PolicyItem[] {
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

export function ProcurementPolicySummary({ settings, className }: Props) {
  const items = buildPolicyItems(settings);

  return (
    <section className={cn("surface-panel space-y-3", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Active procurement policies</h2>
          <p className="text-xs text-muted-foreground">
            Tenant defaults applied to purchase orders, receipts, and matching.
          </p>
        </div>
        <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" asChild>
          <Link href="/settings/modules/procurement?tab=policies">
            <Settings2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Edit policies
          </Link>
        </Button>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {item.label}
            </dt>
            <dd className="mt-0.5">
              {item.tone ? (
                <Badge variant={toneBadgeVariant(item.tone)} className="max-w-full truncate">
                  {item.value}
                </Badge>
              ) : (
                <span className="text-sm font-medium">{item.value}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
