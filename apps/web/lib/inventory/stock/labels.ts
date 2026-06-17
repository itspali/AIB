import type { StockAdjustmentKind, StockListViewMode } from "@/lib/inventory/stock/types";

const STOCK_VIEW_MODE_LABELS: Record<StockListViewMode, string> = {
  balances: "On-hand",
  adjustments: "Adjustments",
  inventory_pools: "Inventory pools",
  promo_reclassification: "Promo reclassification",
};

export function stockListViewModeLabel(viewMode: StockListViewMode): string {
  return STOCK_VIEW_MODE_LABELS[viewMode];
}

const KIND_LABELS: Record<StockAdjustmentKind, string> = {
  OPENING: "Opening balance",
  CORRECTION: "Correction",
  WRITE_OFF: "Write-off",
};

export const STOCK_ADJUSTMENT_KINDS: StockAdjustmentKind[] = [
  "CORRECTION",
  "OPENING",
  "WRITE_OFF",
];

export function stockAdjustmentKindLabel(kind: StockAdjustmentKind): string {
  return KIND_LABELS[kind];
}

const INVENTORY_TRANSACTION_LABELS: Record<string, string> = {
  PURCHASE_RECEIPT: "Purchase receipt",
  SALES_SHIPMENT: "Sales shipment",
  PRODUCTION_CONSUMPTION: "Production consumption",
  PRODUCTION_YIELD: "Production yield",
  STOCK_TRANSFER: "Stock transfer",
  INVENTORY_ADJUSTMENT: "Inventory adjustment",
  CYCLE_COUNT_CORRECTION: "Cycle count correction",
  COST_RESTATEMENT: "Cost restatement",
  COST_CORRECTION: "Cost correction",
};

export function inventoryTransactionTypeLabel(transactionType: string): string {
  return INVENTORY_TRANSACTION_LABELS[transactionType] ?? transactionType.replace(/_/g, " ");
}
