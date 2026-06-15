import {
  formatDocumentDecimal,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import {
  formatPoPeekComputedDiscountAmountDisplay,
  formatPoPeekDiscountEntryDisplay,
  inferPoLineDiscountTypeFromSaved,
} from "@/lib/procurement/purchase-orders/po-line-discount";
import { computeSalesLineGross } from "@/lib/sales/orders/totals";

export type SalesCommercePeekLineRow = {
  id: string;
  item_name: string;
  variant_id: string;
  variant_sku: string;
  unit_price_selling: string;
  discount_percentage: string;
  discount_amount: string;
  line_tax_amount: string;
  base_unit_of_measure?: string | null;
  uom_code?: string | null;
  uom_conversion_factor?: string | null;
  quantity_ordered?: string;
  quantity_quoted?: string;
  quantity_invoiced?: string;
  line_total_gross?: string;
  line_total_net?: string;
};

export type SalesPeekQuantityField = "quantity_ordered" | "quantity_quoted" | "quantity_invoiced";
export type SalesPeekLineTotalField = "line_total_gross" | "line_total_net";

export type SalesPeekLineDisplayOptions = {
  quantityField: SalesPeekQuantityField;
  lineTotalField: SalesPeekLineTotalField;
  discountAmountColumn?: DocumentColumnPref | null;
};

function formatPeekDecimal(raw: string, column: DocumentColumnPref): string {
  const trimmed = raw.trim();
  if (!trimmed) return "—";
  const parsed = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return trimmed;
  return formatDocumentDecimal(parsed, resolveColumnDecimalPlaces(column));
}

function resolvePeekQuantity(line: SalesCommercePeekLineRow, quantityField: SalesPeekQuantityField): string {
  return line[quantityField]?.trim() ?? "";
}

function resolvePeekLineTotal(line: SalesCommercePeekLineRow, lineTotalField: SalesPeekLineTotalField): string {
  return line[lineTotalField]?.trim() ?? "";
}

export function resolveSalesPeekLineUnitCode(line: SalesCommercePeekLineRow): string | null {
  return line.uom_code?.trim() || line.base_unit_of_measure?.trim() || null;
}

function toDiscountTotalsInput(
  line: SalesCommercePeekLineRow,
  quantityField: SalesPeekQuantityField
) {
  return {
    quantity_ordered: resolvePeekQuantity(line, quantityField),
    unit_price_contractual: line.unit_price_selling,
    discount_percentage: line.discount_percentage,
    discount_amount: line.discount_amount,
    discount_type: inferPoLineDiscountTypeFromSaved(line),
  };
}

export function resolveSalesPeekLineTaxRateDisplay(
  line: SalesCommercePeekLineRow,
  column: DocumentColumnPref,
  quantityField: SalesPeekQuantityField
): string {
  if (!line.variant_id?.trim()) return "—";
  const gross = computeSalesLineGross({
    [quantityField]: resolvePeekQuantity(line, quantityField),
    unit_price_selling: line.unit_price_selling,
    discount_percentage: line.discount_percentage,
    discount_amount: line.discount_amount,
  });
  const taxAmount = Number(line.line_tax_amount.replace(/,/g, ""));
  if (!Number.isFinite(taxAmount) || taxAmount <= 0 || gross <= 0) return "—";
  const rate = (taxAmount / gross) * 100;
  return `${formatDocumentDecimal(rate, resolveColumnDecimalPlaces(column))}%`;
}

export function resolveSalesPeekLineTaxAmountDisplay(
  line: SalesCommercePeekLineRow,
  column: DocumentColumnPref
): string {
  if (!line.variant_id?.trim()) return "—";
  const amount = Number(line.line_tax_amount.replace(/,/g, ""));
  if (!Number.isFinite(amount)) return "—";
  return formatDocumentDecimal(amount, resolveColumnDecimalPlaces(column));
}

/** Read-only peek line cell value for a saved sales commerce line. */
export function resolveSalesPeekLineCellDisplay(
  column: DocumentColumnPref,
  line: SalesCommercePeekLineRow,
  options: SalesPeekLineDisplayOptions
): string | null {
  const { quantityField, lineTotalField } = options;

  switch (column.id) {
    case "item":
      return line.item_name?.trim() || null;
    case "sku":
      return line.variant_sku?.trim() || null;
    case "quantity_ordered":
      return formatPeekDecimal(resolvePeekQuantity(line, quantityField), column);
    case "unit":
      return resolveSalesPeekLineUnitCode(line);
    case "unit_price":
      return formatPeekDecimal(line.unit_price_selling, column);
    case "line_total":
      return formatPeekDecimal(resolvePeekLineTotal(line, lineTotalField), column);
    case "discount_pct":
      return formatPoPeekDiscountEntryDisplay(line, column);
    case "discount_amount":
      return formatPoPeekComputedDiscountAmountDisplay(
        toDiscountTotalsInput(line, quantityField),
        options.discountAmountColumn ?? column
      );
    case "tax_rate_pct":
      return resolveSalesPeekLineTaxRateDisplay(line, column, quantityField);
    case "line_tax_amount":
      return resolveSalesPeekLineTaxAmountDisplay(line, column);
    default:
      return null;
  }
}
