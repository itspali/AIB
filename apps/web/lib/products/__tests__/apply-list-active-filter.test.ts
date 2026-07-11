import { describe, expect, it } from "vitest";
import {
  applyListActiveStatusFilter,
  findIsActivePredicate,
  isActiveStatusOnlyStructuralFilter,
  shouldIntersectServerFilteredItemIds,
} from "@/lib/products/apply-list-active-filter";
import { collapseVariantListRows, injectVariantParentRows } from "@/lib/products/list-row-key";
import {
  countDisplayedProductListRows,
  shapeDisplayedProductListRows,
} from "@/lib/products/shape-displayed-product-list";
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
    updated_at: "2026-01-01T00:00:00.000Z",
    variant_id: "variant-1",
    variant_attributes: { Color: "Red" },
    variant_is_active: true,
    variant_strategy: "MULTI_SKU",
    style_code: "STYLE-1",
    variant_is_master: false,
    variant_is_sellable: true,
    ...partial,
  };
}

describe("applyListActiveStatusFilter", () => {
  it("keeps only active variant rows when filtering active with variants expanded", () => {
    const variants = [
      sampleRow({ variant_id: "v1", variant_is_active: true, default_sku: "SKU-A" }),
      sampleRow({ variant_id: "v2", variant_is_active: false, default_sku: "SKU-B" }),
      sampleRow({ variant_id: "v3", variant_is_active: false, default_sku: "SKU-C" }),
    ];
    const shaped = injectVariantParentRows(variants);

    const filtered = applyListActiveStatusFilter(
      shaped,
      [{ kind: "predicate", field: "is_active", operator: "EQ", value: true }],
      true
    );

    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.variant_id).toBe("v1");
  });

  it("drops synthetic parent headers for active filters", () => {
    const variants = [
      sampleRow({ variant_id: "v1", variant_is_active: true }),
      sampleRow({ variant_id: "v2", variant_is_active: false }),
    ];
    const shaped = injectVariantParentRows(variants);

    expect(shaped.some((row) => row.variant_id == null)).toBe(true);

    const filtered = applyListActiveStatusFilter(
      shaped,
      [{ kind: "predicate", field: "is_active", operator: "EQ", value: true }],
      true
    );

    expect(filtered.every((row) => row.variant_id != null)).toBe(true);
  });

  it("finds is_active predicates in mixed ast", () => {
    expect(
      findIsActivePredicate([
        { kind: "text", value: "widget" },
        { kind: "predicate", field: "is_active", operator: "EQ", value: false },
      ])
    ).toEqual({
      kind: "predicate",
      field: "is_active",
      operator: "EQ",
      value: false,
    });
  });

  it("detects active-only structural filters", () => {
    const activeOnly = [
      { kind: "predicate", field: "is_active", operator: "EQ", value: true },
    ] as const;

    expect(isActiveStatusOnlyStructuralFilter(activeOnly)).toBe(true);
    expect(shouldIntersectServerFilteredItemIds(activeOnly)).toBe(false);
  });

  it("keeps server intersection for mixed structural filters", () => {
    const mixed = [
      { kind: "predicate", field: "is_active", operator: "EQ", value: false },
      { kind: "predicate", field: "category_id", operator: "EQ", value: "cat-1" },
    ] as const;

    expect(isActiveStatusOnlyStructuralFilter(mixed)).toBe(false);
    expect(shouldIntersectServerFilteredItemIds(mixed)).toBe(true);
  });

  it("collapses variant rows before counting inactive items", () => {
    const variants = [
      sampleRow({ id: "active-item", variant_id: "v1", variant_is_active: true }),
      sampleRow({ id: "active-item", variant_id: "v2", variant_is_active: false }),
      sampleRow({
        id: "inactive-item",
        is_active: false,
        variant_id: "v3",
        variant_is_active: false,
      }),
    ];

    const shaped = shapeDisplayedProductListRows(variants, {
      showVariants: false,
      sortField: "name",
      sortDirection: "asc",
      activeAst: [{ kind: "predicate", field: "is_active", operator: "EQ", value: false }],
    });

    expect(shaped).toHaveLength(1);
    expect(shaped[0]?.id).toBe("inactive-item");
    expect(countDisplayedProductListRows(shaped, false)).toBe(1);
  });

  it("counts one active item when variant rows are collapsed", () => {
    const variants = [
      sampleRow({ id: "item-1", variant_id: "v1", variant_is_active: true }),
      sampleRow({ id: "item-1", variant_id: "v2", variant_is_active: false }),
      sampleRow({ id: "item-1", variant_id: "v3", variant_is_active: false }),
      sampleRow({ id: "item-2", is_active: false, variant_id: "v4", variant_is_active: false }),
    ];

    const collapsed = collapseVariantListRows(variants);
    expect(collapsed).toHaveLength(2);

    const shaped = shapeDisplayedProductListRows(variants, {
      showVariants: false,
      sortField: "name",
      sortDirection: "asc",
      activeAst: [{ kind: "predicate", field: "is_active", operator: "EQ", value: true }],
    });

    expect(shaped).toHaveLength(1);
    expect(shaped[0]?.id).toBe("item-1");
    expect(countDisplayedProductListRows(shaped, false)).toBe(1);
  });
});
