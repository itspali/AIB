import { describe, expect, it } from "vitest";
import { injectVariantParentRows } from "@/lib/products/list-row-key";
import { countProductListWorkspaceRows } from "@/lib/products/list-workspace-count";
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

describe("countProductListWorkspaceRows", () => {
  it("counts all rows when variants are collapsed", () => {
    expect(countProductListWorkspaceRows([sampleRow(), sampleRow({ id: "item-2" })], false)).toBe(
      2
    );
  });

  it("excludes injected parent headers when variants are expanded", () => {
    const shaped = injectVariantParentRows([
      sampleRow({ variant_id: "v1" }),
      sampleRow({ variant_id: "v2", default_sku: "SKU-2" }),
    ]);

    expect(shaped).toHaveLength(3);
    expect(countProductListWorkspaceRows(shaped, true)).toBe(2);
  });
});
