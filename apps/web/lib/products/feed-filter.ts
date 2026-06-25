import type { ProductListRow } from "@/lib/products/types";

/** Client-side quick filter for Items catalog feed / matrix list panes. */
export function filterProductListRowsByFeedQuery(
  products: ProductListRow[],
  filterQuery: string
): ProductListRow[] {
  const needle = filterQuery.trim().toLowerCase();
  if (!needle) return products;
  return products.filter((row) => {
    const sku = row.default_sku?.toLowerCase() ?? "";
    const name = row.name.toLowerCase();
    const category = row.category_name?.toLowerCase() ?? "";
    return name.includes(needle) || sku.includes(needle) || category.includes(needle);
  });
}
