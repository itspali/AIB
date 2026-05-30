import type { ProductListRow } from "@/lib/products/types";

export function productListRowKey(row: ProductListRow, showVariants: boolean): string {
  return showVariants && row.variant_id ? row.variant_id : row.id;
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
