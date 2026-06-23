import type { CatalogItemSettings } from "@/lib/products/catalog-item-settings";
import type { ItemClassification } from "@/lib/products/classification-labels";
import { normalizeCompositionFromDetail } from "@/lib/products/composition";
import {
  itemLifecycleStatusFromActive,
  type ItemCostingMethod,
  type ItemSource,
  type ItemStatus,
  type ItemTrackingMode,
  type ItemType,
} from "@/lib/products/item-model";
import { filterUserCustomFieldEntries } from "@/lib/products/catalog-reserved-fields";
import { pickPrimaryImagePreviewUrl } from "@/lib/products/primary-image";
import { valuationsBelowReorder } from "@/lib/products/stock-status";
import { normalizeTaxCategory, type TaxCategory } from "@/lib/products/tax-options";
import type { ProductVariantStrategy } from "@/lib/products/variant-strategy";

export type ProductPeekSection = "variants" | "media" | "reach";

export type ProductPeekPanelId = "essentials" | "variants" | "media" | "reach";

export type ProductVariantCountSummary = {
  total: number;
  sellable: number;
};

export type ProductListRow = {
  id: string;
  name: string;
  image_url: string | null;
  description: string | null;
  classification: ItemClassification;
  base_unit_of_measure: string;
  category_id: string | null;
  category_name: string | null;
  hsn_sac_code: string | null;
  has_variants: boolean;
  /** Sellable SKUs on the item (from list workspace view). */
  sellable_variant_count?: number;
  default_tax_category: TaxCategory;
  is_active: boolean;
  is_purchasable: boolean;
  is_salable: boolean;
  is_returnable: boolean;
  default_variant_id: string | null;
  default_sku: string | null;
  barcode: string | null;
  selling_price: string | null;
  mrp: string | null;
  purchase_price: string | null;
  supplier_name: string | null;
  stock_on_hand: string | null;
  /** Product default reorder (item custom_fields); per-location overrides drive below_reorder. */
  reorder_point?: string | null;
  /** True when any stocked location is at or below its effective reorder threshold. */
  below_reorder?: boolean;
  created_at: string;
  updated_at: string;
  variant_strategy?: ProductVariantStrategy;
  style_code?: string | null;
  /** Populated when loading from variant-expanded list projection. */
  variant_id?: string | null;
  variant_attributes?: Record<string, unknown> | null;
  variant_is_active?: boolean;
  variant_is_master?: boolean;
  variant_is_sellable?: boolean;
};

export type ProductTagSnapshot = {
  id: string;
  name: string;
  slug: string;
};

export type ProductAlternateUomSnapshot = {
  uom_code: string;
  conversion_factor: string;
};

export type ProductStorefrontVisibilitySnapshot = {
  storefront_id: string;
  storefront_name: string;
  channel_type: string;
  is_visible: boolean;
  store_custom_name: string | null;
  store_price_book_id: string | null;
};

export type ProductCatalogContext = {
  base_currency: string;
  inventory_valuation_method: string;
  runtime_valuation_engine: "MWAC" | "LOCATION_SCOPED";
  runtime_valuation_note: string;
  catalog_items: CatalogItemSettings;
  suppliers: Array<{ id: string; name: string }>;
  tags: ProductTagSnapshot[];
  storefronts: Array<{ id: string; name: string; channel_type: string; slug: string }>;
  price_books: Array<{ id: string; name: string; currency_code: string }>;
  tax_codes: Array<{
    id: string;
    code: string;
    name: string;
    rate: number;
    kind: string;
    is_variable: boolean;
  }>;
  uoms: Array<{
    id: string;
    code: string;
    name: string;
    family: string;
    factor_to_base: number;
    is_family_base: boolean;
  }>;
};

export type ProductValuationSnapshot = {
  location_id: string;
  location_name: string;
  total_quantity_on_hand: string;
  current_average_cost: string;
};

export type ProductVariantSnapshot = {
  id: string;
  sku: string;
  barcode: string | null;
  variant_attributes: Record<string, unknown>;
  dead_weight_kg: string;
  volume: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  is_active: boolean;
  is_master: boolean;
  is_sellable: boolean;
  price: string;
  purchase_price: string | null;
  supplier_name: string | null;
  created_at: string;
};

export type ProductMediaSnapshot = {
  id: string;
  item_id: string;
  variant_id: string | null;
  storage_url: string;
  preview_url: string | null;
  sort_order: number;
  is_primary: boolean;
  show_on_storefront: boolean;
  show_in_digital_catalog: boolean;
  show_on_internal_transactions: boolean;
  created_at: string;
};

export type ProductDetailSnapshot = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  classification: ItemClassification;
  base_unit_of_measure: string;
  category_id: string | null;
  category_name: string | null;
  hsn_sac_code: string | null;
  is_purchasable: boolean;
  is_salable: boolean;
  has_variants: boolean;
  variant_strategy: ProductVariantStrategy;
  variant_axes: string[];
  item_type: ItemType;
  track_inventory: boolean;
  status: ItemStatus;
  needs_review: boolean;
  source: ItemSource;
  costing_method: ItemCostingMethod;
  standard_cost: string;
  tracking_mode: ItemTrackingMode;
  is_bundle: boolean;
  price_is_tax_inclusive: boolean;
  default_tax_category: TaxCategory;
  tax_code_id: string | null;
  is_returnable: boolean;
  is_active: boolean;
  variant_id: string;
  sku: string;
  barcode: string | null;
  variant_attributes: Record<string, unknown>;
  dead_weight_kg: string;
  volume: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  variant_is_active: boolean;
  selling_price: string;
  mrp: string;
  reorder_point: string;
  selling_uom: string;
  purchase_uom: string;
  purchase_uom_conversion: string;
  purchase_price: string;
  supplier_id: string | null;
  supplier_name: string | null;
  valuations: ProductValuationSnapshot[];
  variants: ProductVariantSnapshot[];
  media: ProductMediaSnapshot[];
  sku_mask: string;
  custom_fields: Array<{ key: string; value: string }>;
  alternate_uoms: ProductAlternateUomSnapshot[];
  tags: ProductTagSnapshot[];
  storefront_visibility: ProductStorefrontVisibilitySnapshot[];
  /** Present when loaded with a scoped fetch; full editor paths upgrade to `full`. */
  detail_scope?: "peek" | "full";
  /** Lightweight counts when peek essentials omit the full variant list. */
  variant_count_summary?: ProductVariantCountSummary;
  /** Deferred peek sections already merged into this snapshot. */
  peek_loaded_sections?: ProductPeekSection[];
  /** Peek stock/valuations were resolved on the server (including an empty result). */
  peek_valuations_resolved?: boolean;
  created_at: string;
  updated_at: string;
};

export type ItemVariantFormValues = {
  variant_id: string | null;
  item_id: string;
  sku: string;
  barcode: string;
  dead_weight_kg: string;
  volume: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  is_active: boolean;
  price: string;
  variant_attributes: Record<string, string>;
};

export type VariantFormDefaults = Partial<
  Pick<
    ItemVariantFormValues,
    | "price"
    | "dead_weight_kg"
    | "volume"
    | "length_cm"
    | "width_cm"
    | "height_cm"
  >
>;

export const defaultVariantFormValues = (
  itemId: string,
  defaults?: VariantFormDefaults
): ItemVariantFormValues => ({
  variant_id: null,
  item_id: itemId,
  sku: "",
  barcode: "",
  dead_weight_kg: defaults?.dead_weight_kg?.trim() || "0",
  volume: defaults?.volume?.trim() ?? "",
  length_cm: defaults?.length_cm?.trim() || "0",
  width_cm: defaults?.width_cm?.trim() || "0",
  height_cm: defaults?.height_cm?.trim() || "0",
  is_active: true,
  price: defaults?.price?.trim() ?? "",
  variant_attributes: {},
});

export function variantSnapshotToFormValues(
  variant: ProductVariantSnapshot,
  itemId: string
): ItemVariantFormValues {
  const variantAttributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(variant.variant_attributes)) {
    if (value === null || value === undefined) continue;
    variantAttributes[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }

  return {
    variant_id: variant.id,
    item_id: itemId,
    sku: variant.sku,
    barcode: variant.barcode ?? "",
    dead_weight_kg: variant.dead_weight_kg,
    volume: variant.volume !== "0" ? variant.volume : "",
    length_cm: variant.length_cm,
    width_cm: variant.width_cm,
    height_cm: variant.height_cm,
    is_active: variant.is_active,
    price: variant.price && variant.price !== "0" ? variant.price : "",
    variant_attributes: variantAttributes,
  };
}

export type ProductMasterFormValues = {
  item_id: string | null;
  /** Snapshot timestamp for optimistic-lock (stale-write) protection on edit. */
  updated_at: string | null;
  classification: ItemClassification;
  name: string;
  description: string;
  sku: string;
  barcode: string;
  base_unit_of_measure: string;
  category_id: string | null;
  is_purchasable: boolean;
  is_salable: boolean;
  is_active: boolean;
  hsn_sac_code: string;
  has_variants: boolean;
  default_tax_category: TaxCategory;
  tax_code_id: string | null;
  is_returnable: boolean;
  dead_weight_kg: string;
  volume: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  variant_is_active: boolean;
  variant_attributes: Record<string, string>;
  selling_price: string;
  mrp: string;
  selling_uom: string;
  purchase_uom: string;
  purchase_uom_conversion: string;
  purchase_price: string;
  supplier_id: string | null;
  show_advanced: boolean;
  sku_mask: string;
  custom_fields: Array<{ key: string; value: string }>;
  alternate_uoms: Array<{ uom_code: string; conversion_factor: string }>;
  tag_ids: string[];
  storefront_visibility: Array<{
    storefront_id: string;
    is_visible: boolean;
    store_custom_name: string;
    store_price_book_id: string | null;
  }>;
  variant_strategy: ProductVariantStrategy;
  /** Category attribute keys this item varies on (drives the variant matrix). */
  variant_axes: string[];
  item_type: ItemType;
  track_inventory: boolean;
  reorder_point: string;
  status: ItemStatus;
  needs_review: boolean;
  costing_method: ItemCostingMethod;
  standard_cost: string;
  tracking_mode: ItemTrackingMode;
  is_bundle: boolean;
  price_is_tax_inclusive: boolean;
};

/** Master form SKU field: product code for multi-SKU, sellable variant SKU otherwise. */
export function resolveMasterFormSku(detail: ProductDetailSnapshot): string {
  if (detail.variant_strategy !== "MULTI_SKU") {
    return detail.sku;
  }
  const code = detail.code?.trim();
  if (code) return code;
  const master = detail.variants.find((variant) => variant.is_master);
  return master?.sku ?? detail.sku;
}

/** True when the detail snapshot represents one sellable multi-SKU variant line. */
export function isDetailVariantSkuContext(detail: ProductDetailSnapshot): boolean {
  if (detail.variant_strategy !== "MULTI_SKU") return false;
  const selected = detail.variants.find((variant) => variant.id === detail.variant_id);
  if (!selected) return false;
  return !selected.is_master;
}

/**
 * Whether loaded detail matches the drawer/list variant target.
 * Item-level opens (no variant in URL) anchor on the master row for multi-SKU items,
 * so variant_id on the snapshot is the master id — not null.
 */
export function detailMatchesDrawerVariant(
  detail: ProductDetailSnapshot,
  variantId?: string | null
): boolean {
  const drawerVariant = variantId?.trim() || null;
  if (!drawerVariant) {
    return !isDetailVariantSkuContext(detail);
  }
  return (detail.variant_id ?? null) === drawerVariant;
}

/** Selected sellable variant when the detail snapshot is variant-scoped. */
export function selectedSellableVariant(
  detail: ProductDetailSnapshot
): ProductVariantSnapshot | null {
  if (!isDetailVariantSkuContext(detail)) return null;
  return detail.variants.find((variant) => variant.id === detail.variant_id) ?? null;
}

export function isVariantCatalogEditMode(
  mode: "create" | "edit" | "view",
  detail: ProductDetailSnapshot | null | undefined
): boolean {
  return mode === "edit" && detail != null && isDetailVariantSkuContext(detail);
}

/**
 * SKU/code shown in product detail identity — aligned with catalog list rows:
 * variant SKU for expanded variant lines; parent product code otherwise.
 */
export function resolveDetailIdentitySku(detail: ProductDetailSnapshot): string {
  if (isDetailVariantSkuContext(detail)) {
    const selected = detail.variants.find((variant) => variant.id === detail.variant_id);
    return selected?.sku?.trim() || detail.sku;
  }
  if (detail.variant_strategy === "MULTI_SKU") {
    return resolveMasterFormSku(detail);
  }
  const code = detail.code?.trim();
  if (code) return code;
  return detail.sku;
}

export function detailToFormValues(detail: ProductDetailSnapshot): ProductMasterFormValues {
  const variantAttributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(detail.variant_attributes)) {
    if (value === null || value === undefined) continue;
    variantAttributes[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }

  const purchaseConversionFromCatalog = detail.alternate_uoms.find(
    (row) => row.uom_code === detail.purchase_uom
  )?.conversion_factor;

  const normalized = normalizeCompositionFromDetail({
    classification: detail.classification,
    is_bundle: detail.is_bundle,
  });

  return {
    item_id: detail.id,
    updated_at: detail.updated_at,
    classification: normalized.classification,
    name: detail.name,
    description: detail.description ?? "",
    sku: resolveMasterFormSku(detail),
    barcode: detail.barcode ?? "",
    base_unit_of_measure: detail.base_unit_of_measure,
    category_id: detail.category_id,
    is_purchasable: detail.is_purchasable,
    is_salable: detail.is_salable,
    is_active: detail.is_active,
    hsn_sac_code: detail.hsn_sac_code ?? "",
    has_variants: detail.has_variants,
    variant_strategy: detail.variant_strategy,
    variant_axes: detail.variant_axes,
    item_type: detail.item_type,
    track_inventory: detail.track_inventory,
    reorder_point: detail.reorder_point,
    status: itemLifecycleStatusFromActive(detail.is_active),
    needs_review: detail.needs_review,
    costing_method: detail.costing_method,
    standard_cost: detail.standard_cost,
    tracking_mode: detail.tracking_mode,
    is_bundle: normalized.is_bundle,
    price_is_tax_inclusive: detail.price_is_tax_inclusive,
    default_tax_category: normalizeTaxCategory(detail.default_tax_category),
    tax_code_id: detail.tax_code_id,
    is_returnable: detail.is_returnable,
    dead_weight_kg: detail.dead_weight_kg,
    volume: detail.volume,
    length_cm: detail.length_cm,
    width_cm: detail.width_cm,
    height_cm: detail.height_cm,
    variant_is_active: detail.variant_is_active,
    variant_attributes: variantAttributes,
    selling_price: detail.selling_price,
    mrp: detail.mrp,
    selling_uom: detail.selling_uom || detail.base_unit_of_measure,
    purchase_uom: detail.purchase_uom || detail.base_unit_of_measure,
    purchase_uom_conversion:
      purchaseConversionFromCatalog ?? detail.purchase_uom_conversion ?? "1",
    purchase_price: detail.purchase_price,
    supplier_id: detail.supplier_id,
    sku_mask: detail.sku_mask,
    custom_fields: filterUserCustomFieldEntries(detail.custom_fields).map((entry) => ({
      ...entry,
    })),
    alternate_uoms: detail.alternate_uoms.map((row) => ({
      uom_code: row.uom_code,
      conversion_factor: row.conversion_factor,
    })),
    tag_ids: detail.tags.map((tag) => tag.id),
    storefront_visibility: detail.storefront_visibility.map((row) => ({
      storefront_id: row.storefront_id,
      is_visible: row.is_visible,
      store_custom_name: row.store_custom_name ?? "",
      store_price_book_id: row.store_price_book_id,
    })),
    show_advanced: Boolean(
      detail.description ||
        detail.hsn_sac_code ||
        detail.has_variants ||
        detail.default_tax_category !== "TAXABLE" ||
        !detail.is_returnable ||
        detail.dead_weight_kg !== "0" ||
        detail.volume !== "0" ||
        detail.length_cm !== "0" ||
        detail.width_cm !== "0" ||
        detail.height_cm !== "0" ||
        !detail.variant_is_active ||
        Object.keys(variantAttributes).length > 0 ||
        detail.sku_mask ||
        detail.custom_fields.length > 0 ||
        detail.alternate_uoms.length > 0 ||
        detail.tags.length > 0 ||
        detail.storefront_visibility.some((row) => row.is_visible)
    ),
  };
}

export const defaultProductFormValues: ProductMasterFormValues = {
  item_id: null,
  updated_at: null,
  classification: "FINISHED_GOOD",
  name: "",
  description: "",
  sku: "",
  barcode: "",
  base_unit_of_measure: "PCS",
  category_id: null,
  is_purchasable: true,
  is_salable: true,
  is_active: true,
  hsn_sac_code: "",
  has_variants: false,
  variant_axes: [],
  default_tax_category: "TAXABLE",
  tax_code_id: null,
  is_returnable: true,
  dead_weight_kg: "0",
  volume: "",
  length_cm: "0",
  width_cm: "0",
  height_cm: "0",
  variant_is_active: true,
  variant_attributes: {},
  selling_price: "",
  mrp: "",
  selling_uom: "PCS",
  purchase_uom: "PCS",
  purchase_uom_conversion: "1",
  purchase_price: "",
  supplier_id: null,
  show_advanced: false,
  sku_mask: "",
  custom_fields: [],
  alternate_uoms: [],
  tag_ids: [],
  storefront_visibility: [],
  variant_strategy: "SINGLE_SKU",
  item_type: "PHYSICAL",
  track_inventory: true,
  reorder_point: "",
  status: "ACTIVE",
  needs_review: false,
  costing_method: "WEIGHTED_AVG",
  standard_cost: "",
  tracking_mode: "NONE",
  is_bundle: false,
  price_is_tax_inclusive: false,
};

export function detailToListRow(detail: ProductDetailSnapshot): ProductListRow {
  const stockTotal = detail.valuations.reduce(
    (sum, row) => sum + Number(row.total_quantity_on_hand),
    0
  );
  const belowReorder =
    detail.track_inventory &&
    valuationsBelowReorder(detail.valuations, detail.reorder_point);

  return {
    id: detail.id,
    name: detail.name,
    image_url: pickPrimaryImagePreviewUrl(detail.media, detail.variant_id, detail.variants),
    description: detail.description,
    classification: detail.classification,
    base_unit_of_measure: detail.base_unit_of_measure,
    category_id: detail.category_id,
    category_name: detail.category_name,
    hsn_sac_code: detail.hsn_sac_code,
    has_variants: detail.has_variants,
    default_tax_category: detail.default_tax_category,
    is_active: detail.is_active,
    is_purchasable: detail.is_purchasable,
    is_salable: detail.is_salable,
    is_returnable: detail.is_returnable,
    default_variant_id: detail.variant_id,
    default_sku: detail.sku,
    barcode: detail.barcode,
    selling_price: detail.selling_price || null,
    mrp: detail.mrp || null,
    purchase_price: detail.purchase_price || null,
    supplier_name: detail.supplier_name,
    stock_on_hand: String(stockTotal),
    reorder_point: detail.reorder_point || null,
    below_reorder: belowReorder,
    created_at: detail.created_at,
    updated_at: detail.updated_at,
    variant_id: detail.variant_id,
    variant_is_active: detail.variant_is_active,
  };
}
