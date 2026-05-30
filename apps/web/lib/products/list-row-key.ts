import type { ProductListRow } from "@/lib/products/types";

export function productListRowKey(row: ProductListRow, showVariants: boolean): string {
  return showVariants && row.variant_id ? row.variant_id : row.id;
}

/** Maps list row selection keys to parent item ids for item-level bulk RPCs. */
export function resolveBulkSelectionItemIds(
  selectedRowKeys: Iterable<string>,
  products: ProductListRow[],
  expandVariants: boolean
): string[] {
  const keys = [...selectedRowKeys];
  if (!expandVariants) {
    return [...new Set(keys)];
  }

  const rowKeyToItemId = new Map(
    products.map((row) => [productListRowKey(row, true), row.id] as const)
  );

  return [...new Set(keys.map((key) => rowKeyToItemId.get(key) ?? key))];
}

export function formatVariantAttributesSubline(
  attributes: Record<string, unknown> | null | undefined
): string | null {
  if (!attributes || typeof attributes !== "object") return null;

  const parts = Object.entries(attributes)
    .filter(([, value]) => value != null && String(value).trim() !== "")
    .map(([key, value]) => `${key}: ${String(value)}`);

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function isProductListRowInactive(row: ProductListRow, showVariants: boolean): boolean {
  if (!row.is_active) return true;
  if (showVariants && row.variant_id && row.variant_is_active === false) return true;
  return false;
}
