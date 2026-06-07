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
export const CATEGORY_FIELDS_SECTION_LABEL = "Category fields";
export const CATEGORY_FIELDS_SECTION_HELP =
  "Fields inherited from the product category — shared on every variant.";
/** @deprecated Use CATEGORY_FIELDS_SECTION_LABEL */
export const PRODUCT_DESCRIPTIVE_ATTRIBUTES_SECTION = CATEGORY_FIELDS_SECTION_LABEL;
/** @deprecated Use CATEGORY_FIELDS_SECTION_HELP */
export const PRODUCT_DESCRIPTIVE_ATTRIBUTES_HELP = CATEGORY_FIELDS_SECTION_HELP;

export function categoryFieldsSectionTitle(categoryName?: string | null): string {
  const name = categoryName?.trim();
  return name ? `${CATEGORY_FIELDS_SECTION_LABEL} · ${name}` : CATEGORY_FIELDS_SECTION_LABEL;
}
export const VARIANT_AXES_LABEL = "Varies by";
export const VARIANT_AXES_HELP =
  "Choose what changes per SKU — for example size or color. Unselected attributes stay the same on every variant. Multi-select fields are product-level only.";
export const VARIANT_AXES_LOCKED_HELP =
  "Locked while sellable variants exist. Change axis values per variant below; add more SKUs with the generator.";
export const VARIANT_SKU_LABEL = "Variant SKU";

export const SUMMARY_PRODUCT_SECTION = "Product";
export const SUMMARY_PRODUCT_SECTION_HELP =
  "Shared catalog profile — name, category, tax, and behavior apply to every variant.";
export const SUMMARY_VARIANT_LINE_SECTION = "This variant";
export const SUMMARY_VARIANT_LINE_HELP =
  "Identifiers, pricing, and shipping for the variant row you opened from the list.";
export const SUMMARY_MASTER_DEFAULTS_SECTION = "Variant defaults";
export const SUMMARY_MASTER_DEFAULTS_HELP =
  "Master row values sellable variants inherit until you override them per SKU.";
export const SUMMARY_VIEWING_VARIANT = "Viewing variant";
export const SUMMARY_PRODUCT_PROFILE = "Product profile";
export const SUMMARY_INHERITED_SUFFIX = "inherited";

export const SUMMARY_INVENTORY_SECTION = "Inventory";
export const SUMMARY_INVENTORY_VARIANT_SECTION = "Inventory · this variant";
export const SUMMARY_INVENTORY_ALL_VARIANTS_HELP =
  "Stock levels and costing across all variant SKUs.";
export const SUMMARY_INVENTORY_VARIANT_HELP =
  "Stock tracking applies to the whole product; quantities below are for this variant SKU.";
export const SUMMARY_INVENTORY_OFF =
  "Inventory tracking is off for this item.";
export const SUMMARY_INVENTORY_BUNDLE_OFF =
  "Inventory tracking is off — stock is tracked on bundle components instead.";

export const SUMMARY_MEDIA_SECTION = "Media";
export const SUMMARY_MEDIA_VARIANT_HELP =
  "Images for this variant SKU, including any shared from the master row.";
export const SUMMARY_MEDIA_PRODUCT_HELP =
  "Product and variant images used on storefront, catalog, and documents.";
export const SUMMARY_MEDIA_EMPTY = "No images uploaded yet.";

export const CATALOG_REACH_TAB_LABEL = "Catalog & reach";
export const VISIBILITY_SECTION_LABEL = "Visibility";
export const VISIBILITY_SECTION_HELP =
  "Where this product is sold: channels, per-variant listings, and physical locations.";
export const VISIBILITY_CHANNELS_SUBSECTION = "Channels";
export const VISIBILITY_VARIANT_CHANNELS_SUBSECTION = "Variant listings";
export const VISIBILITY_VARIANT_CHANNELS_HELP =
  "Refine which variant SKUs appear on each channel. Only channels listed above are shown here.";
export const VISIBILITY_VARIANT_CHANNELS_EMPTY =
  "List this product on at least one channel above to configure variant listings.";
export const VISIBILITY_MATRIX_BULK_LIST = "List selected on all channels";
export const VISIBILITY_MATRIX_BULK_UNLIST = "Unlist selected on all channels";
export const VISIBILITY_MATRIX_STOCK_LABEL = "Stock";
export const VISIBILITY_MATRIX_REORDER_LABEL = "Reorder";
export const VISIBILITY_MATRIX_SHOW_REORDER_LEVELS = "Reorder levels";
export const SAVE_ITEM_LABEL = "Save item";
export const UPDATE_ITEM_LABEL = "Update item";
export const ITEM_SAVE_PARTIAL_REACH_ERROR =
  "Product profile saved, but some Reach settings could not be saved. See highlighted sections.";
export const ITEM_SAVE_SUCCESS = "Product master profile saved successfully";
export const VISIBILITY_MATRIX_SELL_LABEL = "Sell";
export const VISIBILITY_OPENING_STOCK_SUBSECTION = "Opening stock";
export const VISIBILITY_OPENING_STOCK_HELP =
  "Set initial on-hand quantities for stocked locations. Cells lock after stock is posted. Use Inventory → Stock for changes after go-live.";
export const VISIBILITY_OPENING_STOCK_SERIAL_BLOCKED =
  "Opening stock via product setup supports quantity-tracked (non-serial/lot) items only. Use Inventory → Stock for serial-tracked products.";
export const VISIBILITY_OPENING_STOCK_EMPTY_ASSORTMENT =
  "Mark variants as stocked under Locations before entering opening quantities.";
export const VISIBILITY_LOCATIONS_SUBSECTION = "Locations";
export const VISIBILITY_LOCATIONS_HELP =
  "Which locations stock and sell each sellable variant SKU. Storage locations also include a Reorder column when inventory tracking is on.";
export const CUSTOM_FIELDS_SECTION_LABEL = "Custom fields";
export const CUSTOM_FIELDS_SECTION_HELP = "Extra catalog details you define for this product.";
export const DISCOVERY_TAGS_SECTION_LABEL = "Discovery tags";
export const DISCOVERY_TAGS_SECTION_HELP = "Labels used to search and filter in the catalog.";
export const SKU_MASK_CATEGORY_SETTINGS_NOTE =
  "Variant SKU patterns are configured on the category, not per product.";
export const CATALOG_REACH_CHANNELS_EMPTY = "Not visible on any storefront channel.";
export const CATALOG_REACH_TAGS_EMPTY = "No discovery tags.";
export const CATALOG_REACH_CUSTOM_FIELDS_EMPTY = "No custom fields.";
export const CATALOG_REACH_RECORD_SUBSECTION = "Record";
export const CATALOG_REACH_DISTRIBUTION_LOADING =
  "Per-variant channel and location settings load when you open Visibility.";

export const BUFFER_THRESHOLDS_SUBSECTION = "Reorder by location";
export const BUFFER_THRESHOLDS_MATRIX_HELP =
  "Set when each sellable variant SKU should be replenished at each stock-holding location. Leave blank to use the product default above. Enter 0 to disable reorder alerts for that cell.";
export const BUFFER_THRESHOLDS_LOADING =
  "Per-variant reorder thresholds load when you open Inventory.";

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
