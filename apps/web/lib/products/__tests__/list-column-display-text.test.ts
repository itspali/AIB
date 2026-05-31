import { describe, expect, it } from "vitest";
import { getProductListCellDisplayTexts } from "@/lib/products/list-column-display-text";
import type { ProductListRow } from "@/lib/products/types";

function sampleRow(partial: Partial<ProductListRow> = {}): ProductListRow {
  return {
    id: "item-1",
    name: "Widget Pro Max",
    image_url: null,
    description: "A long description value",
    classification: "PHYSICAL_GOOD",
    base_unit_of_measure: "PCS",
    category_id: null,
    category_name: "Hardware",
    hsn_sac_code: "1234",
    has_variants: true,
    default_tax_category: "STANDARD",
    is_active: true,
    is_purchasable: true,
    is_salable: true,
    is_returnable: false,
    default_variant_id: "variant-1",
    default_sku: "SKU-LONG-001",
    barcode: "8901234567890",
    selling_price: "1299.50",
    purchase_price: "899",
    supplier_name: "Acme Supplies International",
    stock_on_hand: "1200",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    variant_id: "variant-1",
    variant_attributes: { Color: "Red", Size: "L" },
    variant_is_active: true,
    ...partial,
  };
}

describe("getProductListCellDisplayTexts", () => {
  it("includes header-competitive name and variant badge text", () => {
    const texts = getProductListCellDisplayTexts(
      "name",
      sampleRow({ variant_strategy: "MULTI_SKU" }),
      { showVariants: true }
    );
    expect(texts).toContain("Widget Pro Max");
    expect(texts.some((value) => value.includes("Variant"))).toBe(true);
    expect(texts).toContain("Color: Red · Size: L");
  });

  it("formats numeric and enum-backed columns as display strings", () => {
    expect(getProductListCellDisplayTexts("default_sku", sampleRow())).toEqual(["SKU-LONG-001"]);
    expect(getProductListCellDisplayTexts("is_active", sampleRow({ is_active: false }))).toEqual([
      "Inactive",
    ]);
    expect(getProductListCellDisplayTexts("stock_on_hand", sampleRow())).toEqual(["1,200"]);
  });
});
