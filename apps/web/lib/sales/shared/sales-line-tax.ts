import {
  formatDocumentDecimal,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoLineTaxCodeOption } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import {
  resolvePoLineTaxAmount,
  type PurchaseOrderTotalsOptions,
} from "@/lib/procurement/purchase-orders/totals";
import { formatPoMoney } from "@/lib/procurement/purchase-orders/totals";
import type { SalesCommerceLineBase } from "@/lib/sales/shared/sales-line-entry";

export type SalesLineTaxDisplayOptions = PurchaseOrderTotalsOptions;

function readSalesLineField(line: SalesCommerceLineBase, field: string): string {
  return String((line as Record<string, unknown>)[field] ?? "");
}

function toPoLineTaxShape(
  line: SalesCommerceLineBase,
  quantityField: string,
  unitPriceField: string
) {
  return {
    quantity_ordered: readSalesLineField(line, quantityField),
    unit_price_contractual: readSalesLineField(line, unitPriceField),
    discount_percentage: line.discount_percentage,
    discount_amount: line.discount_amount,
    discount_type: line.discount_type,
    catalog_context: line.catalog_context,
  };
}

function formatTaxRate(rate: number, column: DocumentColumnPref): string {
  if (!Number.isFinite(rate) || rate <= 0) return "—";
  return `${formatDocumentDecimal(rate, resolveColumnDecimalPlaces(column))}%`;
}

export function canEditSalesLineTaxRate(
  line: SalesCommerceLineBase,
  taxCodeOptions: readonly PoLineTaxCodeOption[] = []
): boolean {
  return Boolean(line.variant_id) && taxCodeOptions.length > 0;
}

export function resolveSalesDraftLineTaxRateDisplay(
  line: SalesCommerceLineBase,
  column: DocumentColumnPref
): string {
  if (!line.variant_id) return "—";
  if (line.catalog_context?.tax_is_variable) return "Variable";
  const rate = line.catalog_context?.tax_rate ?? 0;
  return formatTaxRate(rate, column);
}

export function resolveSalesDraftLineTaxAmountDisplay(
  line: SalesCommerceLineBase,
  column: DocumentColumnPref,
  quantityField: string,
  unitPriceField: string,
  options: SalesLineTaxDisplayOptions = {}
): string {
  if (!line.variant_id) return "—";
  if (line.catalog_context?.tax_is_variable) return "—";
  const resolved = resolveSalesDraftLineTaxAmount(
    line,
    quantityField,
    unitPriceField,
    options
  );
  return formatPoMoney(resolved.taxAmount, resolveColumnDecimalPlaces(column));
}

export function resolveSalesDraftLineTaxAmount(
  line: SalesCommerceLineBase,
  quantityField: string,
  unitPriceField: string,
  options: SalesLineTaxDisplayOptions = {}
) {
  return resolvePoLineTaxAmount(
    toPoLineTaxShape(line, quantityField, unitPriceField),
    options
  );
}

export function patchSalesLineTaxCodeSelection(
  line: SalesCommerceLineBase,
  taxCodeId: string,
  options: readonly PoLineTaxCodeOption[]
): Partial<SalesCommerceLineBase> {
  if (!line.catalog_context) return {};

  const selected = options.find((entry) => entry.id === taxCodeId);
  if (!selected) return {};

  return {
    catalog_context: {
      ...line.catalog_context,
      tax_code_id: selected.id,
      tax_rate: selected.rate,
      tax_is_variable: selected.is_variable,
      tax_components: selected.components.map((component) => ({ ...component })),
    },
  };
}
