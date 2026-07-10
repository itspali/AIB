import { describe, expect, it } from "vitest";
import { resolveDeletedRowCountDelta } from "@/lib/products/resolve-deleted-row-count-delta";
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
    default_tax_category: "TAXABLE",
    is_active: true,
    is_purchasable: true,
    is_salable: true,
    is_returnable: true,
    default_variant_id: "variant-1",
    default_sku: "SKU-1",
    barcode: null,
    selling_price: null,
    mrp: null,
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

describe("resolveDeletedRowCountDelta", () => {
  it("counts deleted item ids in master (collapsed) mode", () => {
    const products = [
      sampleRow({ id: "a" }),
      sampleRow({ id: "b" }),
      sampleRow({ id: "c" }),
    ];
    expect(resolveDeletedRowCountDelta(products, ["a", "c"], false)).toBe(2);
  });

  it("counts loaded variant rows plus unloaded items in expand mode", () => {
    const products = [
      sampleRow({ id: "a", variant_id: "v1" }),
      sampleRow({ id: "a", variant_id: "v2" }),
      sampleRow({ id: "b", variant_id: "v3" }),
    ];
    // a has 2 loaded rows; c is unloaded → +1
    expect(resolveDeletedRowCountDelta(products, ["a", "c"], true)).toBe(3);
  });

  it("returns 0 for an empty delete set", () => {
    expect(resolveDeletedRowCountDelta([sampleRow({ id: "a" })], [], true)).toBe(0);
  });
});
