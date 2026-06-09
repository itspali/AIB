import type { StockVariantOption } from "@/lib/inventory/stock/types";

export function filterStockVariantSuggestions(
  variants: StockVariantOption[],
  query: string
): StockVariantOption[] {
  const term = query.trim().toLowerCase();
  if (!term) return variants;

  return variants.filter(
    (variant) =>
      variant.variant_sku.toLowerCase().includes(term) ||
      variant.item_name.toLowerCase().includes(term)
  );
}
