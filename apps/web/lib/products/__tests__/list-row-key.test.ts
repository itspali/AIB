import { describe, expect, it } from "vitest";
import {
  formatVariantAttributesSubline,
  isProductListRowInactive,
  productListRowKey,
} from "@/lib/products/list-row-key";
import type { ProductListRow } from "@/lib/products/types";

function sampleRow(partial: Partial<ProductListRow> = {}): ProductListRow {
  return {
    id: "item-1",
    name: "Sample",
    image_url: null,
    description: null,
    classification: "PHYSICAL_GOOD",
    base_unit_of_measure: "PCS",
    category_id: null,
    category_name: null,
    hsn_sac_code: null,
    has_variants: true,
    default_tax_category: "STANDARD",
    is_active: true,
    is_purchasable: true,
    is_salable: true,
    is_returnable: true,
    default_variant_id: "variant-1",
    default_sku: "SKU-1",
    barcode: null,
    selling_price: null,
    purchase_price: null,
    supplier_name: null,
    stock_on_hand: "0",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    variant_id: "variant-1",
    variant_attributes: { Color: "Red" },
    variant_is_active: true,
    ...partial,
  };
}

describe("productListRowKey", () => {
  it("uses item id in master mode", () => {
    expect(productListRowKey(sampleRow(), false)).toBe("item-1");
  });

  it("uses variant id when showVariants is enabled", () => {
    expect(productListRowKey(sampleRow(), true)).toBe("variant-1");
  });

  it("falls back to item id when variant id is missing", () => {
    expect(productListRowKey(sampleRow({ variant_id: null }), true)).toBe("item-1");
  });
});

describe("formatVariantAttributesSubline", () => {
  it("joins attribute pairs for display", () => {
    expect(formatVariantAttributesSubline({ Color: "Red", Size: "M" })).toBe("Color: Red · Size: M");
  });

  it("returns null for empty attributes", () => {
    expect(formatVariantAttributesSubline({})).toBeNull();
  });
});

describe("isProductListRowInactive", () => {
  it("marks inactive variants in expanded mode", () => {
    expect(isProductListRowInactive(sampleRow({ variant_is_active: false }), true)).toBe(true);
  });

  it("ignores variant flag in master mode", () => {
    expect(isProductListRowInactive(sampleRow({ variant_is_active: false }), false)).toBe(false);
  });
});
