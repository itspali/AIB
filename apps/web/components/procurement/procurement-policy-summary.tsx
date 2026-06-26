"use client";

import Link from "next/link";
import { SETTINGS_ROUTES } from "@/lib/settings/navigation";
import { Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  buildProcurementPolicyItems,
  toneBadgeVariant,
  type PolicySnapshot,
} from "@/lib/procurement/policy-summary-items";
import { cn } from "@/lib/utils";

type Props = {
  settings: PolicySnapshot;
  className?: string;
};

export function ProcurementPolicySummary({ settings, className }: Props) {
  const items = buildProcurementPolicyItems(settings);

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
          <Link href={`${SETTINGS_ROUTES.operationsProcurement}?tab=policies`}>
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
