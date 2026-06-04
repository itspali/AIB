import {
  extractMrpFromCustomFields,
  normalizeCatalogQuantityField,
} from "@/lib/products/catalog-reserved-fields";

export { extractMrpFromCustomFields } from "@/lib/products/catalog-reserved-fields";

export function normalizeMatrixPriceDefault(value: string | undefined): string {
  return normalizeCatalogQuantityField(value);
}

/** Cost for matrix preview: buy rate first, then standard cost. */
export function resolveMatrixCostDefault(
  purchasePrice: string | undefined,
  standardCost: string | undefined
): string {
  return (
    normalizeMatrixPriceDefault(purchasePrice) ||
    normalizeMatrixPriceDefault(standardCost)
  );
}
