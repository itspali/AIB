import type { ItemClassification } from "@/lib/products/classification-labels";
import { pickPrimaryImagePreviewUrl } from "@/lib/products/primary-image";
import type { TaxCategory } from "@/lib/products/tax-options";

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
  default_tax_category: TaxCategory;
  is_active: boolean;
  is_purchasable: boolean;
  is_salable: boolean;
  is_returnable: boolean;
  default_variant_id: string | null;
  default_sku: string | null;
  barcode: string | null;
  selling_price: string | null;
  purchase_price: string | null;
  supplier_name: string | null;
  stock_on_hand: string | null;
  created_at: string;
  updated_at: string;
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
  runtime_valuation_engine: "MWAC";
  suppliers: Array<{ id: string; name: string }>;
  tags: ProductTagSnapshot[];
  storefronts: Array<{ id: string; name: string; channel_type: string; slug: string }>;
  price_books: Array<{ id: string; name: string }>;
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
  weight: string;
  volume: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  is_active: boolean;
  is_master: boolean;
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
  description: string | null;
  classification: ItemClassification;
  base_unit_of_measure: string;
  category_id: string | null;
  category_name: string | null;
  hsn_sac_code: string | null;
  is_purchasable: boolean;
  is_salable: boolean;
  has_variants: boolean;
  default_tax_category: TaxCategory;
  is_returnable: boolean;
  is_active: boolean;
  variant_id: string;
  sku: string;
  barcode: string | null;
  variant_attributes: Record<string, unknown>;
  dead_weight_kg: string;
  weight: string;
  volume: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  variant_is_active: boolean;
  selling_price: string;
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
  created_at: string;
  updated_at: string;
};

export type ItemVariantFormValues = {
  variant_id: string | null;
  item_id: string;
  sku: string;
  barcode: string;
  dead_weight_kg: string;
  weight: string;
  volume: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  is_active: boolean;
  variant_attributes: Record<string, string>;
};

export const defaultVariantFormValues = (itemId: string): ItemVariantFormValues => ({
  variant_id: null,
  item_id: itemId,
  sku: "",
  barcode: "",
  dead_weight_kg: "0",
  weight: "",
  volume: "",
  length_cm: "0",
  width_cm: "0",
  height_cm: "0",
  is_active: true,
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
    weight: variant.weight !== "0" ? variant.weight : "",
    volume: variant.volume !== "0" ? variant.volume : "",
    length_cm: variant.length_cm,
    width_cm: variant.width_cm,
    height_cm: variant.height_cm,
    is_active: variant.is_active,
    variant_attributes: variantAttributes,
  };
}

export type ProductMasterFormValues = {
  item_id: string | null;
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
  is_returnable: boolean;
  dead_weight_kg: string;
  weight: string;
  volume: string;
  length_cm: string;
  width_cm: string;
  height_cm: string;
  variant_is_active: boolean;
  variant_attributes: Record<string, string>;
  selling_price: string;
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
};

export function detailToFormValues(detail: ProductDetailSnapshot): ProductMasterFormValues {
  const variantAttributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(detail.variant_attributes)) {
    if (value === null || value === undefined) continue;
    variantAttributes[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }

  const extraAlternateUoms = detail.alternate_uoms.filter(
    (row) => row.uom_code !== detail.purchase_uom
  );

  return {
    item_id: detail.id,
    classification: detail.classification,
    name: detail.name,
    description: detail.description ?? "",
    sku: detail.sku,
    barcode: detail.barcode ?? "",
    base_unit_of_measure: detail.base_unit_of_measure,
    category_id: detail.category_id,
    is_purchasable: detail.is_purchasable,
    is_salable: detail.is_salable,
    is_active: detail.is_active,
    hsn_sac_code: detail.hsn_sac_code ?? "",
    has_variants: detail.has_variants,
    default_tax_category: detail.default_tax_category,
    is_returnable: detail.is_returnable,
    dead_weight_kg: detail.dead_weight_kg,
    weight: detail.weight,
    volume: detail.volume,
    length_cm: detail.length_cm,
    width_cm: detail.width_cm,
    height_cm: detail.height_cm,
    variant_is_active: detail.variant_is_active,
    variant_attributes: variantAttributes,
    selling_price: detail.selling_price,
    selling_uom: detail.selling_uom || detail.base_unit_of_measure,
    purchase_uom: detail.purchase_uom || detail.base_unit_of_measure,
    purchase_uom_conversion: detail.purchase_uom_conversion || "1",
    purchase_price: detail.purchase_price,
    supplier_id: detail.supplier_id,
    sku_mask: detail.sku_mask,
    custom_fields: detail.custom_fields.map((entry) => ({ ...entry })),
    alternate_uoms: extraAlternateUoms.map((row) => ({
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
        detail.default_tax_category !== "STANDARD" ||
        !detail.is_returnable ||
        detail.dead_weight_kg !== "0" ||
        detail.weight !== "0" ||
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
  default_tax_category: "STANDARD",
  is_returnable: true,
  dead_weight_kg: "0",
  weight: "",
  volume: "",
  length_cm: "0",
  width_cm: "0",
  height_cm: "0",
  variant_is_active: true,
  variant_attributes: {},
  selling_price: "",
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
};

export function detailToListRow(detail: ProductDetailSnapshot): ProductListRow {
  const stockTotal = detail.valuations.reduce(
    (sum, row) => sum + Number(row.total_quantity_on_hand),
    0
  );

  return {
    id: detail.id,
    name: detail.name,
    image_url: pickPrimaryImagePreviewUrl(detail.media, detail.variant_id),
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
    purchase_price: detail.purchase_price || null,
    supplier_name: detail.supplier_name,
    stock_on_hand: String(stockTotal),
    created_at: detail.created_at,
    updated_at: detail.updated_at,
  };
}
