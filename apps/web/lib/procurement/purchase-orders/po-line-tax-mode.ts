export type PoPricesTaxMode = "exclusive" | "inclusive";

export const PO_PRICES_TAX_MODE_LABEL: Record<PoPricesTaxMode, string> = {
  exclusive: "Tax exclusive",
  inclusive: "Tax inclusive",
};

export const PO_PRICES_TAX_MODE_SHORT_LABEL: Record<PoPricesTaxMode, string> = {
  exclusive: "Ex. tax",
  inclusive: "Inc. tax",
};

export function poPricesTaxInclusiveToMode(inclusive: boolean): PoPricesTaxMode {
  return inclusive ? "inclusive" : "exclusive";
}

export function poPricesTaxModeToInclusive(mode: PoPricesTaxMode): boolean {
  return mode === "inclusive";
}

export function resolvePoUnitPriceColumnLabel(pricesTaxInclusive: boolean): string {
  return pricesTaxInclusive ? "Offer price (inc tax)" : "Offer price (ex tax)";
}

const UNIT_PRICE_EX_TAX_SUFFIX = /\(ex tax\)/i;
const UNIT_PRICE_INC_TAX_SUFFIX = /\(inc tax\)/i;

/** Layout-driven unit price header — swaps ex/inc suffix when present; otherwise uses tenant label as-is. */
export function resolvePoUnitPriceColumnLabelFromLayout(
  layoutLabel: string,
  pricesTaxInclusive: boolean
): string {
  const trimmed = layoutLabel.trim();
  if (!trimmed) return resolvePoUnitPriceColumnLabel(pricesTaxInclusive);

  if (UNIT_PRICE_EX_TAX_SUFFIX.test(trimmed) || UNIT_PRICE_INC_TAX_SUFFIX.test(trimmed)) {
    if (pricesTaxInclusive) {
      return trimmed.replace(UNIT_PRICE_EX_TAX_SUFFIX, "(inc tax)");
    }
    return trimmed.replace(UNIT_PRICE_INC_TAX_SUFFIX, "(ex tax)");
  }

  return trimmed;
}

export function resolvePoUnitPriceAriaLabel(pricesTaxInclusive: boolean): string {
  return pricesTaxInclusive ? "Offer unit price inc tax" : "Offer unit price ex tax";
}

export function resolvePoLineTotalColumnLabel(_pricesTaxInclusive?: boolean): string {
  return "Line total";
}

export function shouldShowPoLineTotalExTaxSubline(
  line: { variant_id?: string; catalog_context?: { tax_is_variable?: boolean } | null },
  resolved: { taxRate: number; taxAmount: number }
): boolean {
  if (!line.variant_id) return false;
  if (line.catalog_context?.tax_is_variable) return false;
  return resolved.taxRate > 0 && resolved.taxAmount > 0;
}

/** Primary line total in the grid (inc-tax when a tax breakdown subline is shown). */
export function resolvePoLineTotalPrimaryAmount(
  resolved: { taxableBase: number; taxAmount: number; lineTotal: number },
  showExTaxSubline: boolean
): number {
  return showExTaxSubline ? resolved.lineTotal : resolved.taxableBase;
}

/** Reconstruct saved line tax amounts for display (`line_total_gross` is always ex-tax base). */
export function resolveSavedPoLineTaxDisplay(line: {
  line_total_gross: string;
  line_tax_amount: string;
  tax_rate_percentage?: string;
  variant_id?: string;
  catalog_context?: { tax_is_variable?: boolean } | null;
}): {
  taxableBase: number;
  taxAmount: number;
  lineTotal: number;
  taxRate: number;
  showExTaxSubline: boolean;
  primaryAmount: number;
} {
  const taxableBase = Number(line.line_total_gross) || 0;
  const taxAmount = Number(line.line_tax_amount) || 0;
  const taxRate = Number(line.tax_rate_percentage) || 0;
  const lineTotal = taxableBase + taxAmount;
  const resolved = { taxableBase, taxAmount, lineTotal, taxRate };
  const showExTaxSubline = shouldShowPoLineTotalExTaxSubline(line, resolved);
  return {
    ...resolved,
    showExTaxSubline,
    primaryAmount: resolvePoLineTotalPrimaryAmount(resolved, showExTaxSubline),
  };
}
