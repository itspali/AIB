import { describe, expect, it } from "vitest";
import {
  buildCompactCardSubline,
  formatCompactCardSubline,
} from "@/lib/products/compact-card-subline";
import type { ProductListRow } from "@/lib/products/types";

function sampleRow(partial: Partial<ProductListRow> = {}): ProductListRow {
  return {
    id: "item-1",
    name: "Widget",
    description: "A widget",
    image_url: null,
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
    is_returnable: false,
    default_variant_id: null,
    default_sku: "WGT-001",
    barcode: null,
    selling_price: null,
    mrp: null,
    purchase_price: null,
    supplier_name: null,
    stock_on_hand: "0",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...partial,
  };
}

describe("compact card subline", () => {
  it("joins SKU and status with a dot", () => {
    const subline = buildCompactCardSubline({
      product: sampleRow(),
      showSku: true,
      showStatus: true,
    });

    expect(subline).not.toBeNull();
    expect(formatCompactCardSubline(subline!)).toBe("WGT-001 · Active");
  });

  it("shows only status when SKU column is hidden", () => {
    const subline = buildCompactCardSubline({
      product: sampleRow({ default_sku: null, is_active: false }),
      showSku: false,
      showStatus: true,
    });

    expect(formatCompactCardSubline(subline!)).toBe("Inactive");
  });

  it("returns null for expanded variant rows because the card header owns variant SKU", () => {
    const subline = buildCompactCardSubline({
      product: sampleRow({
        has_variants: true,
        variant_strategy: "MULTI_SKU",
        variant_id: "variant-1",
        style_code: "STYLE-001",
        default_sku: "VAR-RED-L",
      }),
      showSku: true,
      showStatus: false,
      showVariants: true,
    });

    expect(subline).toBeNull();
  });

  it("treats single-sku items as master rows even when a default variant id is present", () => {
    const subline = buildCompactCardSubline({
      product: sampleRow({
        has_variants: false,
        variant_strategy: "SINGLE_SKU",
        variant_id: "variant-1",
        style_code: "STYLE-001",
        default_sku: "SKU-ONLY",
      }),
      showSku: true,
      showStatus: false,
      showVariants: true,
    });

    expect(formatCompactCardSubline(subline!)).toBe("STYLE-001");
  });
});
