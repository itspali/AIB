import type { StockAdjustmentRow } from "@/lib/inventory/stock/types";

export type InventoryOverviewSnapshot = {
  /** Sum of on-hand quantity × average cost across tracked balances. */
  inventoryValuation: number;
  /** Distinct variant×location balance rows at or below reorder. */
  belowReorderCount: number;
  /** Balance rows with positive on-hand quantity. */
  stockedBalanceCount: number;
  recentAdjustments: StockAdjustmentRow[];
};
