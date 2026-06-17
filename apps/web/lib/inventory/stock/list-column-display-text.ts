import { formatDate } from "@/lib/dashboard/format";
import type {
  StockAdjustmentColumnId,
  StockBalanceColumnId,
} from "@/lib/inventory/stock/list-columns";
import { stockAdjustmentKindLabel } from "@/lib/inventory/stock/labels";
import type { StockAdjustmentRow, StockBalanceRow } from "@/lib/inventory/stock/types";

export function getStockBalanceCellDisplayTexts(
  columnId: StockBalanceColumnId,
  row: StockBalanceRow
): string[] {
  switch (columnId) {
    case "location": {
      const texts = [row.location_name?.trim() || "—"];
      if (row.location_code?.trim()) texts.push(row.location_code.trim());
      return texts;
    }
    case "item": {
      const texts = [row.item_name?.trim() || "—"];
      if (row.variant_sku?.trim()) texts.push(row.variant_sku.trim());
      return texts;
    }
    case "sku":
      return [row.variant_sku];
    case "on_hand":
      return row.below_reorder
        ? [String(row.total_quantity_on_hand), "Low"]
        : [String(row.total_quantity_on_hand)];
    case "available":
      return [String(row.quantity_available)];
    case "reserved":
      return [String(row.quantity_reserved)];
    case "promo_on_hand":
      return [row.promo_quantity_on_hand ?? "—"];
    case "avg_cost":
      return [row.current_average_cost];
    case "reorder":
      return [row.reorder_point ?? "—"];
    default:
      return ["—"];
  }
}

export function getStockAdjustmentCellDisplayTexts(
  columnId: StockAdjustmentColumnId,
  row: StockAdjustmentRow
): string[] {
  switch (columnId) {
    case "document":
      return [row.adjustment_number];
    case "location": {
      const texts = [row.location_name?.trim() || "—"];
      if (row.location_code?.trim()) texts.push(row.location_code.trim());
      return texts;
    }
    case "kind":
      return [stockAdjustmentKindLabel(row.kind)];
    case "reason":
      return [row.reason?.trim() || "—"];
    case "lines":
      return [String(row.line_count)];
    case "posted":
      return [formatDate(row.posted_at)];
    default:
      return ["—"];
  }
}
