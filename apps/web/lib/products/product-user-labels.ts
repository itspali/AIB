/**
 * User-facing labels for the product catalog. Internal code may still use
 * item / master / variant_strategy; UI copy should import from here.
 */

export const PRODUCT_LABEL = "Product";
export const PRODUCT_LABEL_PLURAL = "Products";

export const VARIANTS_SECTION_LABEL = "Variants";
export const VARIANTS_SECTION_SHORT_LABEL = "Variants";

export const VARIANT_STRATEGY_FIELD_LABEL = "Variant SKUs";

export const VARIANTS_LIST_TOGGLE_LABEL = "Variants";
export const VARIANTS_LIST_TOGGLE_HELP =
  "Show each sellable variant on its own row. Turn off for one row per product.";

export const VARIANT_NOT_SOLD_BADGE = "Not sold";
export const VARIANT_DEFAULT_BADGE = "Default";

export const VARIANTS_EMPTY_STATE = "No variants yet.";
export const VARIANTS_PEEK_DESCRIPTION = (sellable: number, total: number) =>
  `${sellable} sellable · ${total} total`;

export const VARIANTS_PANEL_TITLE = "Variants";
export const VARIANTS_PANEL_HELP_MULTI =
  "Add sellable variants here (for example each size, color, or configuration). Product name, category, and tax are in the sections above.";
export const VARIANTS_PANEL_HELP_SINGLE =
  "Additional variants beyond the default. Product details above apply to every variant.";
export const VARIANTS_PANEL_NOT_SOLD_HELP =
  "This row is not sold separately. It holds shared details; sellable variants are listed below.";

export const VARIANT_ATTRIBUTES_SECTION = "Variant attributes";
export const VARIANT_AXES_LABEL = "Varies by";
export const VARIANT_AXES_HELP =
  "Choose what changes per SKU — for example size or color. Unselected attributes stay the same on every variant.";
export const VARIANT_SKU_LABEL = "Variant SKU";

export const SELL_PRICE_COLUMN = "Sell price";
export const BUY_PRICE_COLUMN = "Buy price";
export const MRP_COLUMN = "MRP";
export const VARIANT_DIMENSIONS_TOGGLE_LABEL = "Dimensions";
export const COST_PRICE_COLUMN = "Cost price";
export const MRP_PRICE_COLUMN = "MRP";
export const HSN_COLUMN = "HSN / SAC";

export const SUPPLIERS_SECTION_LABEL = "Suppliers";
export const SUPPLIERS_SECTION_HELP =
  "Catalog quotes from vendors. Add multiple suppliers per variant; mark one as preferred for lists and purchase orders.";

export const PRODUCT_SAVED_TOAST = "Product saved.";
export const VARIANTS_ADD_HINT_TOAST =
  "Product saved. Add more variants under Variants.";

export function productCountLabel(count: number): string {
  return `${count} product${count === 1 ? "" : "s"}`;
}

export function archiveProductsTitle(count: number): string {
  return `Archive selected ${productCountLabel(count)}?`;
}
