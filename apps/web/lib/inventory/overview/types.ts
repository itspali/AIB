import type { StockAdjustmentRow, StockBalanceRow } from "@/lib/inventory/stock/types";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";

export type BelowReorderOverviewRow = StockBalanceRow & {
  suggested_source_location_id: string | null;
  suggested_source_location_name: string | null;
};

export type InventoryOverviewSnapshot = {
  /** Sum of on-hand quantity × average cost across tracked balances. */
  inventoryValuation: number;
  /** Distinct variant×location balance rows at or below reorder. */
  belowReorderCount: number;
  /** Balance rows with positive on-hand quantity. */
  stockedBalanceCount: number;
  /** Transfers currently in DISPATCHED_IN_TRANSIT status. */
  inTransitTransferCount: number;
  /** Posted procurement GIT vouchers awaiting clearance. */
  procurementGitInTransitCount: number;
  /** Lowest on-hand balances at or below reorder (capped for overview). */
  belowReorderBalances: BelowReorderOverviewRow[];
  recentTransfers: StockTransferRow[];
  recentAdjustments: StockAdjustmentRow[];
};
