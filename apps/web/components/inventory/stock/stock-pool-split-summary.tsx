"use client";

import type { PromoInventoryBalanceRow } from "@/lib/inventory/stock/promo-balances";
import {
  quarantineTypeLabel,
  sumPromoQuantities,
  sumSellableQuantities,
} from "@/lib/inventory/stock/promo-pool-helpers";
import type { StockBalanceRow } from "@/lib/inventory/stock/types";
import { Badge } from "@/components/ui/badge";

type Props = {
  sellableRows: StockBalanceRow[];
  promoBalances: PromoInventoryBalanceRow[];
};

function formatTotal(value: number): string {
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2);
}

export function StockPoolSplitSummary({ sellableRows, promoBalances }: Props) {
  const sellableTotal = sumSellableQuantities(sellableRows);
  const promoTotal = sumPromoQuantities(promoBalances);
  const hasPromo = promoBalances.length > 0;

  if (sellableTotal === 0 && !hasPromo) return null;

  return (
    <section className="mb-4 space-y-3 rounded-lg border border-border bg-muted/20 p-4">
      <div>
        <h2 className="text-sm font-semibold">Inventory pools</h2>
        <p className="text-xs text-muted-foreground">
          Sellable stock is valued at moving average cost. Promotional and sample quantities sit in a
          separate sub-pool until reclassified or consumed by sales fulfillment.
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:max-w-md">
        <div className="rounded-md border border-border bg-background px-3 py-2">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Sellable (MWAC)
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatTotal(sellableTotal)}</dd>
        </div>
        <div className="rounded-md border border-border bg-background px-3 py-2">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Promo / sample
          </dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{formatTotal(promoTotal)}</dd>
        </div>
      </dl>

      {hasPromo ? (
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Promo sub-pool detail</p>
          <ul className="space-y-2 text-sm">
            {promoBalances.slice(0, 8).map((row) => (
              <li key={row.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 truncate">
                  {row.item_name} · {row.variant_sku} · {row.location_name}
                </span>
                <span className="inline-flex shrink-0 items-center gap-2">
                  <Badge variant="locked" className="text-[10px]">
                    {quarantineTypeLabel(row.quarantine_type)}
                  </Badge>
                  <span className="font-medium tabular-nums">{row.quantity_on_hand}</span>
                </span>
              </li>
            ))}
          </ul>
          {promoBalances.length > 8 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              +{promoBalances.length - 8} more promo balance rows
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
