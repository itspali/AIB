"use client";

import {
  computePurchaseOrderTotals,
  formatPoMoney,
  type PurchaseOrderTotalsSnapshot,
} from "@/lib/procurement/purchase-orders/totals";
import { filterSavablePoLines, type PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { cn } from "@/lib/utils";

type Props = {
  lines: PoDraftLine[];
  className?: string;
  layout?: "rail" | "footer" | "embedded";
  showSectionTitle?: boolean;
  /** Keep footer totals visible on large viewports (narrow 40vw drawer). */
  showFooterOnLarge?: boolean;
};

function TotalsCard({ totals, className }: { totals: PurchaseOrderTotalsSnapshot; className?: string }) {
  return (
    <div className={cn("surface-inset p-4", className)}>
      <TotalsBody totals={totals} />
    </div>
  );
}

function TotalsBody({ totals }: { totals: PurchaseOrderTotalsSnapshot }) {
  return (
    <dl className="space-y-2 text-sm">
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted-foreground">Lines</dt>
        <dd className="tabular-nums font-medium">{totals.filledLineCount}</dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted-foreground">Subtotal (ex tax)</dt>
        <dd className="tabular-nums font-medium">{formatPoMoney(totals.subtotalGross)}</dd>
      </div>
      <div className="flex items-center justify-between gap-3">
        <dt className="text-muted-foreground">Tax</dt>
        <dd className="tabular-nums text-muted-foreground">{formatPoMoney(totals.taxAmount)}</dd>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
        <dt className="font-semibold">Total</dt>
        <dd className="tabular-nums text-base font-semibold">{formatPoMoney(totals.grandTotal)}</dd>
      </div>
    </dl>
  );
}

export function PoTotalsPanel({
  lines,
  className,
  layout = "rail",
  showSectionTitle = true,
  showFooterOnLarge = false,
}: Props) {
  const totals = computePurchaseOrderTotals(filterSavablePoLines(lines));

  if (layout === "embedded") {
    return <TotalsCard totals={totals} className={className} />;
  }

  if (layout === "footer") {
    return (
      <div
        className={cn(
          "shrink-0 border-t border-border pt-3",
          !showFooterOnLarge && "lg:hidden",
          className
        )}
      >
        <TotalsBody totals={totals} />
      </div>
    );
  }

  return (
    <aside className={cn("hidden min-w-0 flex-col gap-3 lg:flex", className)}>
      {showSectionTitle ? (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Summary
        </p>
      ) : null}
      <TotalsCard totals={totals} />
    </aside>
  );
}
