import {
  formatDocumentDecimal,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import {
  getPoLayoutColumnPref,
  normalizePoLayoutTemplate,
  type DocumentLayoutDefaults,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";
import type { PoTaxSupplyNature } from "@/lib/procurement/purchase-orders/po-tax-supply";
import {
  resolvePoLineTaxAmount,
  type PurchaseOrderTotalsOptions,
} from "@/lib/procurement/purchase-orders/totals";

export type PoLineTaxDisplayOptions = PurchaseOrderTotalsOptions & {
  taxSupplyNature?: PoTaxSupplyNature;
};

/** True when the Tax % line field is visible as its own column. */
export function isPoTaxRateLineFieldVisible(
  layout: DocumentLayoutDefaults
): boolean {
  return (
    getPoLayoutColumnPref(normalizePoLayoutTemplate(layout), "tax_rate_pct")
      ?.defaultVisible === true
  );
}

/** Embed tax rate under line tax when the standalone Tax % column is off. */
export function shouldShowPoTaxRateUnderLineTaxColumn(
  layout: DocumentLayoutDefaults
): boolean {
  const normalized = normalizePoLayoutTemplate(layout);
  const lineTaxVisible =
    getPoLayoutColumnPref(normalized, "line_tax_amount")?.defaultVisible === true;
  return lineTaxVisible && !isPoTaxRateLineFieldVisible(normalized);
}

function formatTaxRate(rate: number, column: DocumentColumnPref): string {
  if (!Number.isFinite(rate) || rate <= 0) return "—";
  return `${formatDocumentDecimal(rate, resolveColumnDecimalPlaces(column))}%`;
}

export function canEditPoLineTaxRate(
  line: PoDraftLine,
  taxCodeOptions: readonly PoLineTaxCodeOption[] = []
): boolean {
  return Boolean(line.variant_id) && taxCodeOptions.length > 0;
}

export function resolvePoDraftLineTaxCodeId(line: PoDraftLine): string {
  return line.catalog_context?.tax_code_id ?? "";
}

/** Live draft line tax rate from catalog. */
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
