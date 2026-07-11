import { describe, expect, it } from "vitest";
import { buildItemDetailHeaderLines } from "@/lib/products/item-detail-header";
import type { ProductDetailSnapshot, ProductListRow } from "@/lib/products/types";

function minimalDetail(
  overrides: Partial<ProductDetailSnapshot>
): ProductDetailSnapshot {
  return {
    id: "item-1",
    name: "Test",
    code: "PARENT-CODE",
    description: null,
    classification: "FINISHED_GOOD",
    base_unit_of_measure: "EA",
    category_id: null,
    category_name: null,
    hsn_sac_code: null,
    is_purchasable: true,
    is_salable: true,
    has_variants: true,
    variant_strategy: "MULTI_SKU",
    variant_axes: ["color"],
    item_type: "PHYSICAL",
    track_inventory: true,
    status: "ACTIVE",
    needs_review: false,
    source: "MANUAL",
    costing_method: "WEIGHTED_AVG",
    standard_cost: "",
    tracking_mode: "NONE",
    is_bundle: true,
    price_is_tax_inclusive: false,
    default_tax_category: "TAXABLE",
    tax_code_id: null,
    is_returnable: true,
    is_active: true,
    variant_id: "v-master",
    sku: "PARENT-CODE",
    barcode: null,
    variant_attributes: {},
    dead_weight_kg: "0",
    volume: "0",
    length_cm: "0",
    width_cm: "0",
    height_cm: "0",
    variant_is_active: true,
    selling_price: "10",
    mrp: "",
    reorder_point: "",
    selling_uom: "EA",
    purchase_uom: "EA",
    purchase_uom_conversion: "1",
    purchase_price: "",
    supplier_id: null,
    supplier_name: null,
    valuations: [],
    variants: [
      {
        id: "v-master",
        sku: "PARENT-CODE",
        barcode: null,
        variant_attributes: {},
        dead_weight_kg: "0",
        volume: "0",
        length_cm: "0",
        width_cm: "0",
        height_cm: "0",
        is_active: true,
        is_master: true,
        is_sellable: false,
        price: "0",
        purchase_price: null,
        supplier_name: null,
        created_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "v-sellable-1",
        sku: "PARENT-CODE-RED",
        barcode: null,
        variant_attributes: { color: "Red" },
        dead_weight_kg: "0",
        volume: "0",
        length_cm: "0",
        width_cm: "0",
        height_cm: "0",
        is_active: true,
        is_master: false,
        is_sellable: true,
        price: "10",
        purchase_price: null,
        supplier_name: null,
        created_at: "2026-01-02T00:00:00.000Z",
      },
      {
        id: "v-sellable-2",
        sku: "PARENT-CODE-BLUE",
        barcode: null,
        variant_attributes: { color: "Blue" },
        dead_weight_kg: "0",
        volume: "0",
        length_cm: "0",
        width_cm: "0",
        height_cm: "0",
        is_active: true,
        is_master: false,
        is_sellable: true,
        price: "12",
        purchase_price: null,
        supplier_name: null,
        created_at: "2026-01-03T00:00:00.000Z",
      },
      {
        id: "v-sellable-3",
        sku: "PARENT-CODE-GREEN",
        barcode: null,
        variant_attributes: { color: "Green" },
        dead_weight_kg: "0",
        volume: "0",
        length_cm: "0",
        width_cm: "0",
        height_cm: "0",
        is_active: true,
        is_master: false,
        is_sellable: true,
        price: "11",
        purchase_price: null,
        supplier_name: null,
        created_at: "2026-01-04T00:00:00.000Z",
      },
    ],
    media: [],
    sku_mask: "",
    custom_fields: [],
    alternate_uoms: [],
    tags: [],
    storefront_visibility: [],
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

function minimalRow(overrides: Partial<ProductListRow> = {}): ProductListRow {
  return {
    id: "item-1",
    name: "NITM0001",
    image_url: null,
    description: null,
    classification: "FINISHED_GOOD",
    base_unit_of_measure: "EA",
    category_id: null,
    category_name: null,
    hsn_sac_code: null,
    has_variants: true,
    default_tax_category: "TAXABLE",
    is_active: true,
    is_purchasable: true,
    is_salable: true,
    is_returnable: true,
    default_variant_id: null,
    default_sku: "NITM0001",
    barcode: null,
    selling_price: "10",
    mrp: null,
    purchase_price: null,
    supplier_name: null,
    stock_on_hand: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    style_code: "NITM0001",
    ...overrides,
  };
}

describe("buildItemDetailHeaderLines", () => {
  it("does not repeat product code when name matches identity SKU", () => {
    const detail = minimalDetail({
      name: "NITM0001",
      code: "NITM0001",
      sku: "NITM0001",
    });

    expect(buildItemDetailHeaderLines(detail, null)).toEqual({
      title: "NITM0001",
      subtitle: "Multiple · 3 sellable variants",
    });
  });

  it("shows distinct name as title and code in subtitle", () => {
    const detail = minimalDetail({
      name: "Winter Jacket",
      code: "PARENT-CODE",
    });

    expect(buildItemDetailHeaderLines(detail, null)).toEqual({
      title: "Winter Jacket",
      subtitle: "PARENT-CODE · Multiple · 3 sellable variants",
    });
  });

  it("uses variant SKU as title when viewing a sellable variant line", () => {
    const detail = minimalDetail({
      variant_id: "v-sellable-1",
      sku: "PARENT-CODE-RED",
      variant_attributes: { color: "Red" },
    });

    expect(buildItemDetailHeaderLines(detail, null)).toEqual({
      title: "PARENT-CODE-RED",
      subtitle: "Viewing variant · color: Red · PARENT-CODE",
    });
  });

  it("falls back to row identity when detail is not loaded yet", () => {
    const row = minimalRow({ name: "NITM0001", style_code: "NITM0001" });

    expect(buildItemDetailHeaderLines(null, row)).toEqual({
      title: "NITM0001",
      subtitle: null,
    });
  });
});
