"use client";

import { Badge } from "@/components/ui/badge";
import { formatPoMoney } from "@/lib/procurement/purchase-orders/totals";
import type { CustomerOption } from "@/lib/sales/shared/types";
import { cn } from "@/lib/utils";

type Props = {
  customer?: CustomerOption;
  orderNetAmount: number;
  className?: string;
};

function parseMoney(value: string | undefined): number {
  const parsed = Number((value ?? "").trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function SalesCustomerCreditPanel({ customer, orderNetAmount, className }: Props) {
  const creditLimit = parseMoney(customer?.credit_limit);
  const currentBalance = parseMoney(customer?.current_balance);
  const projectedBalance = currentBalance + Math.max(0, orderNetAmount);
  const hasLimit = creditLimit > 0;
  const utilizationPct = hasLimit ? (projectedBalance / creditLimit) * 100 : 0;
  const isBreached = hasLimit && projectedBalance > creditLimit;

  if (!customer) return null;

  return (
    <section
      className={cn(
        "rounded-md border p-3",
        isBreached ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-muted/15",
        className
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Customer credit
        </p>
        {isBreached ? (
          <Badge variant="administrative" className="text-xs font-normal">
            Limit exceeded
          </Badge>
        ) : hasLimit ? (
          <Badge variant="administrative" className="text-xs font-normal">
            Within limit
          </Badge>
        ) : (
          <Badge variant="administrative" className="text-xs font-normal">
            No limit set
          </Badge>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Credit limit</dt>
        <dd className="text-right tabular-nums font-medium">
          {hasLimit ? formatPoMoney(creditLimit) : "—"}
        </dd>
        <dt className="text-muted-foreground">Current balance</dt>
        <dd className="text-right tabular-nums font-medium">{formatPoMoney(currentBalance)}</dd>
        <dt className="text-muted-foreground">This order</dt>
        <dd className="text-right tabular-nums font-medium">{formatPoMoney(orderNetAmount)}</dd>
        <dt className="text-muted-foreground">Projected balance</dt>
        <dd
          className={cn(
            "text-right tabular-nums font-medium",
            isBreached && "text-amber-700 dark:text-amber-300"
          )}
        >
          {formatPoMoney(projectedBalance)}
          {hasLimit ? ` (${utilizationPct.toFixed(0)}%)` : ""}
        </dd>
      </dl>
      {isBreached ? (
        <p className="mt-2 text-xs leading-snug text-muted-foreground">
          Saving may place this order on credit hold or block confirmation, depending on tenant
          credit policy.
        </p>
      ) : null}
    </section>
  );
}
