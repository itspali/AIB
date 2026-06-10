export type PoPricesTaxMode = "exclusive" | "inclusive";

export const PO_PRICES_TAX_MODE_LABEL: Record<PoPricesTaxMode, string> = {
  exclusive: "Tax exclusive",
  inclusive: "Tax inclusive",
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

export function resolvePoUnitPriceAriaLabel(pricesTaxInclusive: boolean): string {
  return pricesTaxInclusive ? "Offer unit price inc tax" : "Offer unit price ex tax";
}

export function resolvePoLineTotalColumnLabel(pricesTaxInclusive: boolean): string {
  return pricesTaxInclusive ? "Line net (inc tax)" : "Line net (ex tax)";
}
