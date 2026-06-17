import { Package } from "lucide-react";
import { Button } from "@/components/ui/button";

import type { StockListViewMode } from "@/lib/inventory/stock/types";

type Props = {
  viewMode: StockListViewMode;
  onCreate?: () => void;
  hasLocations?: boolean;
};

export function StockEmptyState({ viewMode, onCreate, hasLocations = true }: Props) {
  const isBalances = viewMode === "balances";
  const isAdjustments = viewMode === "adjustments";
  const isInventoryPools = viewMode === "inventory_pools";
  const isPromoReclassification = viewMode === "promo_reclassification";

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-xl border border-dashed border-border/80 border-black/[0.06] bg-muted/35 px-6 py-12 text-center dark:border-white/10 dark:bg-muted/20">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 ring-1 ring-primary/20">
        <Package className="h-8 w-8 text-primary" aria-hidden />
      </div>
      <p className="max-w-md text-sm font-medium">
        {isInventoryPools
          ? "No inventory pool quantities are recorded yet."
          : isPromoReclassification
            ? "No promotional reclassification work is pending."
            : isBalances
              ? "No on-hand balances match your filters yet."
              : "No stock adjustments have been posted yet."}
      </p>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {hasLocations
          ? isInventoryPools
            ? "Sellable, QC hold, and promotional sub-pools appear here after receipts and adjustments post."
            : isPromoReclassification
              ? "Select promotional balances to draft a batch, then post them into sellable stock at average cost."
              : isBalances
                ? "Post an opening or correction adjustment to establish quantities at a stock-holding location."
                : "Create a location-scoped adjustment document to correct on-hand quantities."
          : "Add an active stock-holding location under Settings → Locations before posting adjustments."}
      </p>
      {onCreate && hasLocations && (isBalances || isAdjustments) ? (
        <Button className="mt-6 shadow-glow-sm" onClick={onCreate}>
          New adjustment
        </Button>
      ) : null}
    </div>
  );
}
