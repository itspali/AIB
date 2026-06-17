"use client";

import { StockPoolSplitSummary } from "@/components/inventory/stock/stock-pool-split-summary";
import type { PromoInventoryBalanceRow } from "@/lib/inventory/stock/promo-balances";
import type { QcInventoryBalanceRow } from "@/lib/inventory/stock/qc-balances";
import {
  sumPromoQuantities,
  sumQcQuantities,
  sumSellableQuantities,
} from "@/lib/inventory/stock/promo-pool-helpers";
import type { StockBalanceRow } from "@/lib/inventory/stock/types";

type Props = {
  sellableRows: StockBalanceRow[];
  promoBalances: PromoInventoryBalanceRow[];
  qcBalances: QcInventoryBalanceRow[];
};

export function StockInventoryPoolsView({
  sellableRows,
  promoBalances,
  qcBalances,
}: Props) {
  const hasPoolData =
    sumSellableQuantities(sellableRows) > 0 ||
    sumPromoQuantities(promoBalances) > 0 ||
    sumQcQuantities(qcBalances) > 0;

  if (!hasPoolData) {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center p-4">
        <div className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No inventory pool quantities match the current filters.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 md:p-4">
      <StockPoolSplitSummary
        className="mb-0"
        sellableRows={sellableRows}
        promoBalances={promoBalances}
        qcBalances={qcBalances}
      />
    </div>
  );
}
