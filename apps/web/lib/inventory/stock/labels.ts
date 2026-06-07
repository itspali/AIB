import type { StockAdjustmentKind } from "@/lib/inventory/stock/types";

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
