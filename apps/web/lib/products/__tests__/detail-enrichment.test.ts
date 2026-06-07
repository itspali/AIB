import { describe, expect, it } from "vitest";
import {
  reanchorProductDetailVariant,
  resolvePeekCachedDetail,
  resolvePeekVariantFocus,
} from "@/lib/products/detail-enrichment";
import type { ProductDetailSnapshot } from "@/lib/products/types";

function sampleDetail(
  partial: Partial<ProductDetailSnapshot> & {
    variant_id: string;
    sku: string;
  }
): ProductDetailSnapshot {
  return {
    id: "item-1",
    name: "Sample",
    code: "NITM0001",
    description: null,
    classification: "FINISHED_GOOD",
    base_unit_of_measure: "PCS",
    category_id: null,
    category_name: null,
    hsn_sac_code: null,
    is_purchasable: true,
    is_salable: true,
    has_variants: true,
    variant_strategy: "MULTI_SKU",
    variant_axes: [],
    item_type: "PHYSICAL",
    track_inventory: true,
    status: "ACTIVE",
    needs_review: false,
    source: "MANUAL",
    costing_method: "WEIGHTED_AVG",
    standard_cost: "",
    tracking_mode: "NONE",
    is_bundle: false,
    price_is_tax_inclusive: false,
    default_tax_category: "TAXABLE",
    tax_code_id: null,
    is_returnable: true,
    is_active: true,
    barcode: null,
    variant_attributes: {},
    dead_weight_kg: "0",
    volume: "0",
    length_cm: "0",
    width_cm: "0",
    height_cm: "0",
    variant_is_active: true,
    selling_price: "",
    mrp: "",
    reorder_point: "",
    selling_uom: "PCS",
    purchase_uom: "PCS",
    purchase_uom_conversion: "1",
    purchase_price: "",
    supplier_id: null,
    supplier_name: null,
    valuations: [],
    media: [],
    sku_mask: "",
    custom_fields: [],
    alternate_uoms: [],
    tags: [],
    storefront_visibility: [],
    detail_scope: "peek",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    variants: [],
    ...partial,
  };
}

describe("resolvePeekVariantFocus", () => {
  it("prefers an explicit variant id when provided", () => {
    const detail = sampleDetail({
      variant_id: "variant-master",
      sku: "NITM0001",
      variants: [
        { id: "variant-master", sku: "NITM0001", is_master: true, is_sellable: false } as never,
        { id: "variant-green", sku: "NITM0001-G", is_master: false, is_sellable: true } as never,
      ],
    });

    expect(resolvePeekVariantFocus(detail, "variant-green")).toBe("variant-green");
  });

  it("anchors item-level peeks on the master variant", () => {
    const detail = sampleDetail({
      variant_id: "variant-green",
      sku: "NITM0001-G",
      variants: [
        { id: "variant-master", sku: "NITM0001", is_master: true, is_sellable: false } as never,
        { id: "variant-green", sku: "NITM0001-G", is_master: false, is_sellable: true } as never,
      ],
    });

    expect(resolvePeekVariantFocus(detail, null)).toBe("variant-master");
  });
});

describe("reanchorProductDetailVariant", () => {
  it("reanchors cached peek data to the master variant for item-level opens", () => {
    const cached = sampleDetail({
      variant_id: "variant-green",
      sku: "NITM0001-G",
      variants: [
        {
          id: "variant-master",
          sku: "NITM0001",
          is_master: true,
          is_sellable: false,
          variant_attributes: {},
        } as never,
        {
          id: "variant-green",
          sku: "NITM0001-G",
          is_master: false,
          is_sellable: true,
          variant_attributes: { color: "Green" },
        } as never,
      ],
    });

    const focusId = resolvePeekVariantFocus(cached, null);
    const reopened = reanchorProductDetailVariant(cached, focusId);

    expect(reopened.variant_id).toBe("variant-master");
    expect(reopened.sku).toBe("NITM0001");
  });
});

describe("resolvePeekCachedDetail", () => {
  it("returns null when the requested variant is not in a partial peek snapshot", () => {
    const cached = sampleDetail({
      variant_id: "variant-green",
      sku: "NITM0001-G",
      variants: [
        {
          id: "variant-master",
          sku: "NITM0001",
          is_master: true,
          is_sellable: false,
          variant_attributes: {},
        } as never,
        {
          id: "variant-green",
          sku: "NITM0001-G",
          is_master: false,
          is_sellable: true,
          variant_attributes: { color: "Green" },
        } as never,
      ],
    });

    expect(resolvePeekCachedDetail(cached, "variant-red")).toBeNull();
  });

  it("reanchors when the requested variant is present in the cached snapshot", () => {
    const cached = sampleDetail({
      variant_id: "variant-master",
      sku: "NITM0001",
      variants: [
        {
          id: "variant-master",
          sku: "NITM0001",
          is_master: true,
          is_sellable: false,
          variant_attributes: {},
        } as never,
        {
          id: "variant-red",
          sku: "NITM0001-R",
          is_master: false,
          is_sellable: true,
          variant_attributes: { color: "Red" },
        } as never,
      ],
    });

    const resolved = resolvePeekCachedDetail(cached, "variant-red");
    expect(resolved?.variant_id).toBe("variant-red");
    expect(resolved?.sku).toBe("NITM0001-R");
  });
});
