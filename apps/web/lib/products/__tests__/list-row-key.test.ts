import { describe, expect, it } from "vitest";
import {
  formatVariantAttributesSubline,
  injectVariantParentRows,
  isProductListRowInactive,
  productListRowKey,
  resolveBulkSelectionItemIds,
  resolveProductListDisplaySku,
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

describe("resolveProductListDisplaySku", () => {
  it("uses variant sku for expanded variant rows", () => {
    expect(
      resolveProductListDisplaySku(
        { style_code: "STYLE-001", default_sku: "VAR-RED-L" },
        "variant"
      )
    ).toBe("VAR-RED-L");
  });

  it("uses style code for parent rows", () => {
    expect(
      resolveProductListDisplaySku(
        { style_code: "STYLE-001", default_sku: "VAR-RED-L" },
        "style"
      )
    ).toBe("STYLE-001");
  });
});

describe("resolveBulkSelectionItemIds", () => {
  it("passes through item ids in master mode", () => {
    const row = sampleRow();
    expect(
      resolveBulkSelectionItemIds(["item-1", "item-2"], [row], false)
    ).toEqual(["item-1", "item-2"]);
  });

  it("maps variant row keys to parent item ids in expanded mode", () => {
    const rows = [
      sampleRow({ variant_id: "variant-1" }),
      sampleRow({ variant_id: "variant-2", default_sku: "SKU-2" }),
    ];

    expect(
      resolveBulkSelectionItemIds(["variant-1", "variant-2"], rows, true)
    ).toEqual(["item-1"]);
  });
});

describe("injectVariantParentRows", () => {
  it("inserts a parent row before the first variant row of each item", () => {
    const variantA = sampleRow({
      id: "item-1",
      variant_id: "variant-a",
      default_sku: "ITM001-RED",
      style_code: "ITM001",
      variant_strategy: "MULTI_SKU",
    });
    const variantB = sampleRow({
      id: "item-1",
      variant_id: "variant-b",
      default_sku: "ITM001-BLUE",
      style_code: "ITM001",
      variant_strategy: "MULTI_SKU",
    });
    const single = sampleRow({
      id: "item-2",
      has_variants: false,
      variant_strategy: "SINGLE_SKU",
      variant_id: null,
      default_sku: "SKU-ONLY",
    });

    const rows = injectVariantParentRows([variantA, variantB, single]);

    expect(rows).toHaveLength(4);
    expect(rows[0]?.id).toBe("item-1");
    expect(rows[0]?.variant_id).toBeNull();
    expect(rows[0]?.default_sku).toBe("ITM001");
    expect(rows[1]).toBe(variantA);
    expect(rows[2]).toBe(variantB);
    expect(rows[3]).toBe(single);
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
