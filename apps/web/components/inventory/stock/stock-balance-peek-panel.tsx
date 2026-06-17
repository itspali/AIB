"use client";

import { useEffect, useMemo, useState } from "react";
import { loadStockLedgerHistoryForVariants } from "@/app/inventory/stock/actions";
import { StockLineLedgerHistorySection } from "@/components/inventory/stock/stock-line-ledger-history-section";
import { Badge } from "@/components/ui/badge";
import type { InventoryLedgerHistoryRow } from "@/lib/inventory/stock/ledger-history";
import type { StockAdjustmentLineRow, StockBalanceRow } from "@/lib/inventory/stock/types";

type Props = {
  balance: StockBalanceRow;
};

export function StockBalancePeekPanel({ balance }: Props) {
  const [ledgerByVariant, setLedgerByVariant] = useState<
    Record<string, InventoryLedgerHistoryRow[]>
  >({});
  const [ledgerLoading, setLedgerLoading] = useState(true);

  const historyLine = useMemo(
    (): StockAdjustmentLineRow => ({
      id: balance.id,
      item_id: balance.item_id,
      item_name: balance.item_name,
      variant_id: balance.variant_id,
      variant_sku: balance.variant_sku,
      quantity_delta: balance.total_quantity_on_hand,
      unit_cost: balance.current_average_cost,
      line_notes: null,
    }),
    [balance]
  );

  useEffect(() => {
    let cancelled = false;
    setLedgerLoading(true);
    void loadStockLedgerHistoryForVariants({
      location_id: balance.location_id,
      variant_ids: [balance.variant_id],
      on_hand_by_variant: {
        [balance.variant_id]: balance.total_quantity_on_hand,
      },
    }).then((result) => {
      if (cancelled) return;
      setLedgerLoading(false);
      if ("error" in result) return;
      setLedgerByVariant(result.entriesByVariantId);
    });

    return () => {
      cancelled = true;
    };
  }, [balance.id, balance.location_id, balance.variant_id]);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Location
          </p>
          <p className="text-sm font-medium">{balance.location_name}</p>
          {balance.location_code ? (
            <p className="text-xs text-muted-foreground">{balance.location_code}</p>
          ) : null}
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Item
          </p>
          <p className="text-sm font-medium">{balance.item_name}</p>
          <p className="font-mono text-xs text-muted-foreground">{balance.variant_sku}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Sellable on hand
          </p>
          <div className="inline-flex items-center gap-2">
            <p className="text-sm font-medium tabular-nums">{balance.total_quantity_on_hand}</p>
            {balance.below_reorder ? (
              <Badge variant="action_required" className="text-[10px]">
                Low
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Avg cost
          </p>
          <p className="text-sm tabular-nums">{balance.current_average_cost}</p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Reorder point
          </p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {balance.reorder_point ?? "—"}
          </p>
        </div>
        {balance.promo_quantity_on_hand ? (
          <div className="space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Promo / sample
            </p>
            <p className="text-sm tabular-nums text-muted-foreground">
              {balance.promo_quantity_on_hand}
            </p>
          </div>
        ) : null}
      </div>

      <StockLineLedgerHistorySection
        lines={[historyLine]}
        entriesByVariantId={ledgerByVariant}
        loading={ledgerLoading}
      />
    </div>
  );
}
