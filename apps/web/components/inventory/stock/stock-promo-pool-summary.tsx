"use client";

import type { PromoInventoryBalanceRow } from "@/lib/inventory/stock/promo-balances";

type Props = {
  balances: PromoInventoryBalanceRow[];
};

export function StockPromoPoolSummary({ balances }: Props) {
  if (balances.length === 0) return null;

  return (
    <section className="mb-4 rounded-lg border border-border bg-muted/20 p-4">
      <h2 className="text-sm font-semibold">Promotional & sample stock</h2>
      <p className="mb-3 text-xs text-muted-foreground">
        Quantities held outside sellable average-cost inventory (free goods, samples, campaign hold).
      </p>
      <ul className="space-y-2 text-sm">
        {balances.slice(0, 8).map((row) => (
          <li key={row.id} className="flex justify-between gap-2">
            <span className="min-w-0 truncate">
              {row.item_name} · {row.variant_sku} · {row.location_name}
            </span>
            <span className="shrink-0 font-medium">{row.quantity_on_hand}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
