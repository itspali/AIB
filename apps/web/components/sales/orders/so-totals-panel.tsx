"use client";

import {
  computeSalesOrderDraftTotals,
  formatSoMoneyWithCurrency,
} from "@/lib/sales/orders/totals";
import type { SoDraftLine } from "@/lib/sales/orders/draft-form";
import { cn } from "@/lib/utils";

type Props = {
  lines: SoDraftLine[];
  currencyCode?: string;
  className?: string;
};

export function SoTotalsPanel({ lines, currencyCode = "USD", className }: Props) {
  const totals = computeSalesOrderDraftTotals(lines);

  return (
    <div className={cn("rounded-lg border border-border bg-muted/20 p-4", className)}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Totals
      </p>
      <dl className="space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular-nums font-medium">
            {formatSoMoneyWithCurrency(totals.subtotal, currencyCode)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground">Tax</dt>
          <dd className="tabular-nums font-medium">
            {formatSoMoneyWithCurrency(totals.totalTax, currencyCode)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border pt-2">
          <dt className="font-semibold text-foreground">Net amount</dt>
          <dd className="tabular-nums text-base font-semibold">
            {formatSoMoneyWithCurrency(totals.net, currencyCode)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
