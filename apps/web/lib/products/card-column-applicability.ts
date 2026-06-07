import type { ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductCardLayout, ProductCardOrientation } from "@/lib/products/list-prefs";

/** Columns rendered on Detail (v2) vertical cards (metrics, details, flags, meta regions). */
const DETAIL_VERTICAL_COLUMNS = new Set<ProductListColumnId>([
  "image",
  "name",
  "default_sku",
  "barcode",
  "category_name",
  "description",
  "base_unit_of_measure",
  "hsn_sac_code",
  "default_tax_category",
  "has_variants",
  "is_active",
  "is_purchasable",
  "is_salable",
  "is_returnable",
  "selling_price",
  "purchase_price",
  "supplier_name",
  "stock_on_hand",
  "created_at",
  "updated_at",
]);

/** Columns rendered on Detail (v2) horizontal row cards (hero + footer rail only). */
const DETAIL_HORIZONTAL_COLUMNS = new Set<ProductListColumnId>([
  "image",
  "name",
  "default_sku",
  "barcode",
  "category_name",
  "description",
  "has_variants",
  "is_active",
  "stock_on_hand",
]);

/** Columns rendered on Shop-style cards. */
const SHOP_CARD_COLUMNS = new Set<ProductListColumnId>([
  "image",
  "name",
  "default_sku",
  "category_name",
  "description",
  "has_variants",
  "is_active",
  "selling_price",
  "purchase_price",
  "stock_on_hand",
  "is_purchasable",
  "is_salable",
  "is_returnable",
  "base_unit_of_measure",
  "hsn_sac_code",
  "default_tax_category",
  "created_at",
  "updated_at",
  "supplier_name",
]);

export function isProductCardColumnApplicable(
  columnId: ProductListColumnId,
  cardLayout: ProductCardLayout,
  cardOrientation: ProductCardOrientation
): boolean {
  if (cardLayout === "shop") {
    return SHOP_CARD_COLUMNS.has(columnId);
  }
  if (cardOrientation === "horizontal") {
    return DETAIL_HORIZONTAL_COLUMNS.has(columnId);
  }
  return DETAIL_VERTICAL_COLUMNS.has(columnId);
}

export function productCardColumnDisabledReason(
  columnId: ProductListColumnId,
  cardLayout: ProductCardLayout,
  cardOrientation: ProductCardOrientation
): string | undefined {
  if (isProductCardColumnApplicable(columnId, cardLayout, cardOrientation)) {
    return undefined;
  }
  if (columnId === "classification") {
    return "Classification is not shown on item cards.";
  }
  if (cardLayout === "shop") {
    return "Not shown on Shop-style cards.";
  }
  if (cardOrientation === "horizontal") {
    return "Not shown on horizontal Detail cards.";
  }
  return "Not shown on vertical Detail cards.";
}
