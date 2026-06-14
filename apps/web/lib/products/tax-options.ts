export const TAX_CATEGORY_OPTIONS = [
  "TAXABLE",
  "NON_TAXABLE",
  "OUT_OF_SCOPE",
  "NON_GST_SUPPLY",
] as const;

export type TaxCategory = (typeof TAX_CATEGORY_OPTIONS)[number];

const LEGACY_TAX_CATEGORY_MAP: Record<string, TaxCategory> = {
  STANDARD: "TAXABLE",
  REDUCED: "TAXABLE",
  ZERO_RATED: "TAXABLE",
  EXEMPT: "NON_TAXABLE",
};

export function isTaxCategory(value: string): value is TaxCategory {
  return (TAX_CATEGORY_OPTIONS as readonly string[]).includes(value);
}

/** Maps legacy rate buckets and new supply-type values to the current taxonomy. */
export function normalizeTaxCategory(value: string | null | undefined): TaxCategory {
  const trimmed = value?.trim().toUpperCase() ?? "";
  if (isTaxCategory(trimmed)) return trimmed;
  return LEGACY_TAX_CATEGORY_MAP[trimmed] ?? "TAXABLE";
}

export function isTaxableSupplyCategory(value: string | null | undefined): boolean {
  return normalizeTaxCategory(value) === "TAXABLE";
}

export function taxCategoryLabel(value: string): string {
  switch (normalizeTaxCategory(value)) {
    case "TAXABLE":
      return "Taxable";
    case "NON_TAXABLE":
      return "Non-Taxable";
    case "OUT_OF_SCOPE":
      return "Out of Scope";
    case "NON_GST_SUPPLY":
      return "Non-GST Supply";
    default:
      return value;
  }
}

/** @deprecated Legacy coarse bucket from tax codes; prefer explicit `default_tax_category` on the form. */
export type TaxCodeForCategoryDerivation = {
  rate: number;
  kind: string;
  is_variable?: boolean;
};

/** Mirrors Postgres derivation in bulk_sync_item_jurisdiction (legacy rate buckets). */
export function deriveDefaultTaxCategoryFromTaxCode(
  taxCode: TaxCodeForCategoryDerivation | null | undefined
): TaxCategory {
  if (!taxCode) return "TAXABLE";

  const kind = taxCode.kind.trim().toUpperCase();
  if (kind === "EXEMPT") return "NON_TAXABLE";

  const rate = Number(taxCode.rate);
  if (kind === "ZERO" || kind === "NIL" || !Number.isFinite(rate) || rate === 0) {
    return "TAXABLE";
  }
  return "TAXABLE";
}

export function resolveTaxCodeFromCatalog(
  taxCodeId: string | null | undefined,
  taxCodes: readonly (TaxCodeForCategoryDerivation & { id: string })[]
): TaxCodeForCategoryDerivation | null {
  if (!taxCodeId) return null;
  const row = taxCodes.find((entry) => entry.id === taxCodeId);
  if (!row) return null;
  return { rate: row.rate, kind: row.kind, is_variable: row.is_variable };
}
