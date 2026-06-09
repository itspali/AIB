import {
  formatDocumentDecimal,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { computeLineGross } from "@/lib/procurement/purchase-orders/totals";

function formatLineDecimal(raw: string, column: DocumentColumnPref): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return formatDocumentDecimal(parsed, resolveColumnDecimalPlaces(column));
}

/** Read-only display for commercial line columns shown under the item cell. */
export function resolveCommercialLineDetailDisplay(
  column: DocumentColumnPref,
  line: PoDraftLine
): string | null {
  if (!line.variant_id) return null;

  switch (column.id) {
    case "sku":
      return line.variant_sku?.trim() || null;
    case "unit":
      return line.catalog_context?.base_unit_of_measure?.trim() || null;
    case "quantity_ordered":
      return formatLineDecimal(line.quantity_ordered, column);
    case "unit_price":
      return formatLineDecimal(line.unit_price_contractual, column);
    case "line_total":
      return formatDocumentDecimal(
        computeLineGross(line),
        resolveColumnDecimalPlaces(column)
      );
    case "discount_pct":
    case "discount_amount":
      return null;
    default:
      return null;
  }
}
