"use client";

import { useMemo } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { creditControlLabel } from "@/lib/organization/credit-control-options";
import { scanIdentifierPolicyLabel } from "@/lib/products/catalog-item-settings";
import { domStrategyLabel } from "@/lib/locations/dom-routing";
import type {
  OrganizationSettingsFormValues,
  OrganizationSettingsSnapshot,
} from "@/lib/organization/types";
import { cn } from "@/lib/utils";

type Props = {
  snapshot: OrganizationSettingsSnapshot;
  form: UseFormReturn<OrganizationSettingsFormValues>;
  className?: string;
  /** header = inline in org hero card; panel = standalone surface panel */
  variant?: "header" | "panel";
};

type PolicyItem = {
  id: string;
  label: string;
  value: string;
  mono?: boolean;
  tone?: "positive" | "neutral" | "caution";
};

function policyTone(
  kind: "allowed" | "enabled" | "restricted" | "neutral",
  active: boolean
): PolicyItem["tone"] {
  if (kind === "neutral") return "neutral";
  if (kind === "restricted") return active ? "caution" : "positive";
  return active ? "positive" : "neutral";
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

function PolicyTile({ item }: { item: PolicyItem }) {
  const useBadge = item.tone !== undefined;

  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {item.label}
      </dt>
      <dd className="mt-0.5 min-w-0">
        {useBadge ? (
          <Badge variant={toneBadgeVariant(item.tone)} className="max-w-full truncate">
            {item.value}
          </Badge>
        ) : (
          <span
            className={cn(
              "block text-sm font-medium leading-snug text-foreground",
              item.mono && "font-mono"
            )}
            title={item.value}
          >
            {item.value}
          </span>
        )}
      </dd>
    </div>
  );
}

export function useOrganizationPolicyItems(
  snapshot: OrganizationSettingsSnapshot,
  formValues: OrganizationSettingsFormValues
): PolicyItem[] {
  return useMemo((): PolicyItem[] => {
    const rows: PolicyItem[] = [
      {
        id: "currency",
        label: "Currency",
        value: formValues.base_currency,
        mono: true,
      },
      {
        id: "valuation",
        label: "Valuation",
        value: formValues.inventory_valuation_method,
      },
      {
        id: "scan",
        label: "Scan lookup",
        value: scanIdentifierPolicyLabel(formValues.scan_identifier_policy),
      },
      {
        id: "auto-sku",
        label: "Auto SKU",
        value: formValues.sku_auto_generation_enabled
          ? `${formValues.sku_auto_pattern} (${formValues.sku_auto_prefix})`
          : "Off",
        mono: formValues.sku_auto_generation_enabled,
      },
      {
        id: "credit",
        label: "Credit",
        value: creditControlLabel(formValues.credit_control_enforcement),
        tone: formValues.credit_control_enforcement === "STRICT" ? "caution" : "neutral",
      },
      {
        id: "discounts",
        label: "Line discounts",
        value: formValues.allow_line_item_discounts ? "Allowed" : "Blocked",
        tone: policyTone("allowed", formValues.allow_line_item_discounts),
      },
      {
        id: "txn-discounts",
        label: "Trade discount",
        value: formValues.allow_transaction_discounts ? "Allowed" : "Blocked",
        tone: policyTone("allowed", formValues.allow_transaction_discounts),
      },
      {
        id: "transfers",
        label: "Transfers",
        value: formValues.restrict_cross_warehouse_transfers ? "Restricted" : "Open",
        tone: policyTone("restricted", formValues.restrict_cross_warehouse_transfers),
      },
      {
        id: "locations",
        label: "Locations",
        value: formValues.multi_location_enabled ? "Multi-site" : "Single site",
        tone: policyTone("enabled", formValues.multi_location_enabled),
      },
      {
        id: "regional",
        label: "Regional HQs",
        value: formValues.regional_hqs_enabled ? "On" : "Off",
        tone: policyTone("enabled", formValues.regional_hqs_enabled),
      },
    ];

    if (snapshot.location_governance_config.dom_routing) {
      rows.push({
        id: "dom",
        label: "DOM routing",
        value: domStrategyLabel(
          snapshot.location_governance_config.dom_routing.primary_fulfillment_strategy
        ),
      });
    }

    return rows;
  }, [formValues, snapshot.location_governance_config.dom_routing]);
}

export function OrganizationPolicySummary({
  snapshot,
  form,
  className,
  variant = "panel",
}: Props) {
  const formValues = form.watch();
  const items = useOrganizationPolicyItems(snapshot, formValues);

  const grid = (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <PolicyTile key={item.id} item={item} />
      ))}
    </dl>
  );

  if (variant === "header") {
    return (
      <div className={cn("border-t border-border pt-3", className)}>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Policy summary
        </p>
        {grid}
      </div>
    );
  }

  return (
    <section className={cn("surface-panel space-y-3 p-3 sm:p-4", className)}>
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <SlidersHorizontal className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Policy summary
      </h2>
      {grid}
    </section>
  );
}
