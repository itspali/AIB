import { describe, expect, it } from "vitest";
import { applyProductListStructuralFilters } from "@/lib/products/resolve-structural-list-filter";
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
    has_variants: false,
    default_tax_category: "TAXABLE",
    is_active: true,
    is_purchasable: true,
    is_salable: true,
    is_returnable: true,
    default_variant_id: null,
    default_sku: "SKU-1",
    barcode: null,
    selling_price: null,
    mrp: null,
    purchase_price: null,
    supplier_name: null,
    stock_on_hand: "0",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    variant_id: null,
    variant_attributes: null,
    variant_strategy: "SINGLE_SKU",
    style_code: null,
    ...partial,
  };
}

describe("applyProductListStructuralFilters", () => {
  it("skips server filtered ids for active-only structural filters", () => {
    const rows = [
      sampleRow({ id: "active" }),
      sampleRow({ id: "inactive", is_active: false }),
    ];

    const filtered = applyProductListStructuralFilters(rows, {
      appliedQuery: "active",
      activeAst: [{ kind: "predicate", field: "is_active", operator: "EQ", value: true }],
      filteredItemIds: new Set(["inactive"]),
    });

    expect(filtered.map((row) => row.id)).toEqual(["active", "inactive"]);
  });

  it("intersects server filtered ids for mixed structural filters", () => {
    const rows = [
      sampleRow({ id: "active" }),
      sampleRow({ id: "inactive", is_active: false }),
    ];

    const filtered = applyProductListStructuralFilters(rows, {
      appliedQuery: "inactive category:apparel",
      activeAst: [
        { kind: "predicate", field: "is_active", operator: "EQ", value: false },
        { kind: "predicate", field: "category_id", operator: "EQ", value: "cat-1" },
      ],
      filteredItemIds: new Set(["inactive"]),
    });

    expect(filtered.map((row) => row.id)).toEqual(["inactive"]);
  });
});
