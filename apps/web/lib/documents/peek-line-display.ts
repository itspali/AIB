import {
  formatDocumentDecimal,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";
import {
  formatPoPeekComputedDiscountAmountDisplay,
  formatPoPeekDiscountEntryDisplay,
} from "@/lib/procurement/purchase-orders/po-line-discount";

function formatPeekDecimal(raw: string, column: DocumentColumnPref): string {
  const trimmed = raw.trim();
  if (!trimmed) return "—";
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return trimmed;
  return formatDocumentDecimal(parsed, resolveColumnDecimalPlaces(column));
}

export type PoPeekLineDisplayOptions = {
  discountAmountColumn?: DocumentColumnPref | null;
};

/** Read-only peek line cell value for a saved purchase order line. */
export function resolvePoPeekLineCellDisplay(
  column: DocumentColumnPref,
  line: PurchaseOrderLineRow,
  options?: PoPeekLineDisplayOptions
): string | null {
  switch (column.id) {
    case "item":
      return line.item_name?.trim() || null;
    case "sku":
      return line.variant_sku?.trim() || null;
    case "quantity_ordered":
      return formatPeekDecimal(line.quantity_ordered, column);
    case "quantity_received":
      return formatPeekDecimal(line.quantity_received, column);
    case "unit":
      return line.uom_code?.trim() || line.base_unit_of_measure?.trim() || null;
    case "unit_price":
      return formatPeekDecimal(line.unit_price_contractual, column);
    case "line_total":
      return formatPeekDecimal(line.line_total_gross, column);
    case "discount_pct":
      return formatPoPeekDiscountEntryDisplay(line, column);
    case "discount_amount":
      return formatPoPeekComputedDiscountAmountDisplay(
        line,
        options?.discountAmountColumn ?? column
      );
    default:
      return null;
  }
}
