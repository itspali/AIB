import { describe, expect, it } from "vitest";
import {
  isDetailVariantSkuContext,
  resolveDetailIdentitySku,
  resolveMasterFormSku,
  type ProductDetailSnapshot,
} from "@/lib/products/types";

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
    variant_id: "v-sellable",
    sku: "PARENT-CODE-RED",
    barcode: null,
    variant_attributes: { color: "Red" },
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
        id: "v-sellable",
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

describe("resolveMasterFormSku", () => {
  it("uses product code for multi-SKU items, not a sellable variant SKU", () => {
    const detail = minimalDetail({});
    expect(resolveMasterFormSku(detail)).toBe("PARENT-CODE");
  });

  it("uses the selected variant SKU for single-SKU items", () => {
    const detail = minimalDetail({
      variant_strategy: "SINGLE_SKU",
      code: "PARENT-CODE",
      sku: "SINGLE-SKU",
    });
    expect(resolveMasterFormSku(detail)).toBe("SINGLE-SKU");
  });
});

describe("resolveDetailIdentitySku", () => {
  it("shows the sellable variant SKU when a multi-SKU variant is selected", () => {
    const detail = minimalDetail({});
    expect(isDetailVariantSkuContext(detail)).toBe(true);
    expect(resolveDetailIdentitySku(detail)).toBe("PARENT-CODE-RED");
  });

  it("shows the parent product code for multi-SKU item-level detail", () => {
    const detail = minimalDetail({
      variant_id: "v-master",
      sku: "PARENT-CODE",
      variant_attributes: {},
    });
    expect(isDetailVariantSkuContext(detail)).toBe(false);
    expect(resolveDetailIdentitySku(detail)).toBe("PARENT-CODE");
  });

  it("prefers items.code for single-SKU detail to match list style rows", () => {
    const detail = minimalDetail({
      variant_strategy: "SINGLE_SKU",
      has_variants: false,
      code: "STYLE-001",
      sku: "SKU-ONLY",
      variants: [
        {
          id: "v-only",
          sku: "SKU-ONLY",
          barcode: null,
          variant_attributes: {},
          dead_weight_kg: "0",
          volume: "0",
          length_cm: "0",
          width_cm: "0",
          height_cm: "0",
          is_active: true,
          is_master: true,
          is_sellable: true,
          price: "10",
          purchase_price: null,
          supplier_name: null,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(resolveDetailIdentitySku(detail)).toBe("STYLE-001");
  });
});
