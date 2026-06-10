import {
  formatDocumentDecimal,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import {
  formatPoLineComputedDiscountAmount,
  resolvePoLineDiscountInputValue,
  resolvePoLineDiscountType,
} from "@/lib/procurement/purchase-orders/po-line-discount";
import {
  resolvePoDraftLineTaxAmountDisplay,
  resolvePoDraftLineTaxRateDisplay,
  type PoLineTaxDisplayOptions,
} from "@/lib/procurement/purchase-orders/po-line-tax";
import {
  resolvePoDraftLineCgstAmountDisplay,
  resolvePoDraftLineIgstAmountDisplay,
  resolvePoDraftLineSgstAmountDisplay,
} from "@/lib/procurement/purchase-orders/po-line-tax-components";
import { resolvePoLineTaxAmount } from "@/lib/procurement/purchase-orders/totals";

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
  line: PoDraftLine,
  options: PoLineTaxDisplayOptions = {}
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
    case "mrp":
      return formatLineDecimal(line.catalog_context?.mrp ?? "", column);
    case "line_total":
      return formatDocumentDecimal(
        resolvePoLineTaxAmount(line, options).taxableBase,
        resolveColumnDecimalPlaces(column)
      );
    case "tax_rate_pct":
      return resolvePoDraftLineTaxRateDisplay(line, column);
    case "line_tax_amount":
      return resolvePoDraftLineTaxAmountDisplay(line, column, options);
    case "cgst_amount":
      return resolvePoDraftLineCgstAmountDisplay(line, column, options);
    case "sgst_amount":
      return resolvePoDraftLineSgstAmountDisplay(line, column, options);
    case "igst_amount":
      return resolvePoDraftLineIgstAmountDisplay(line, column, options);
    case "discount_pct": {
      const value = resolvePoLineDiscountInputValue(line);
      const formatted = formatLineDecimal(value, column);
      if (!formatted) return null;
      return resolvePoLineDiscountType(line) === "percent" ? `${formatted}%` : formatted;
    }
    case "discount_amount":
      return formatPoLineComputedDiscountAmount(line, column);
    default:
      return null;
  }
}
