import {
  formatDocumentDecimal,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";
import type { PoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";
import {
  resolvePoLineTaxAmount,
  type PurchaseOrderTotalsOptions,
} from "@/lib/procurement/purchase-orders/totals";

export type PoLineTaxDisplayOptions = PurchaseOrderTotalsOptions & {
  taxSupplyNature?: PoTaxSupplyNature;
};

function formatTaxRate(rate: number, column: DocumentColumnPref): string {
  if (!Number.isFinite(rate) || rate <= 0) return "—";
  return `${formatDocumentDecimal(rate, resolveColumnDecimalPlaces(column))}%`;
}

/** Live draft line tax rate from catalog (read-only). */
export function resolvePoDraftLineTaxRateDisplay(
  line: PoDraftLine,
  column: DocumentColumnPref
): string {
  if (!line.variant_id) return "—";
  const variable = line.catalog_context?.tax_is_variable;
  if (variable) return "Variable";
  const rate = line.catalog_context?.tax_rate ?? 0;
  return formatTaxRate(rate, column);
}

/** Live draft line tax amount (read-only). */
export function resolvePoDraftLineTaxAmountDisplay(
  line: PoDraftLine,
  column: DocumentColumnPref,
  options: PoLineTaxDisplayOptions = {}
): string {
  if (!line.variant_id) return "—";
  if (line.catalog_context?.tax_is_variable) return "—";
  const resolved = resolvePoLineTaxAmount(line, options);
  if (resolved.taxAmount <= 0) return formatDocumentDecimal(0, resolveColumnDecimalPlaces(column));
  return formatDocumentDecimal(resolved.taxAmount, resolveColumnDecimalPlaces(column));
}

/** Saved PO line tax rate. */
export function resolvePoPeekLineTaxRateDisplay(
  line: PurchaseOrderLineRow,
  column: DocumentColumnPref
): string {
  const rate = Number(line.tax_rate_percentage);
  return formatTaxRate(rate, column);
}

/** Saved PO line tax amount. */
export function resolvePoPeekLineTaxAmountDisplay(
  line: PurchaseOrderLineRow,
  column: DocumentColumnPref
): string {
  const amount = Number(line.line_tax_amount);
  if (!Number.isFinite(amount)) return "—";
  return formatDocumentDecimal(amount, resolveColumnDecimalPlaces(column));
}
