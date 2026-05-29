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
    classification: "PRODUCT",
    base_unit_of_measure: "PCS",
    category_id: null,
    category_name: null,
    hsn_sac_code: null,
    has_variants: false,
    default_tax_category: "STANDARD",
    is_active: true,
    is_purchasable: true,
    is_salable: true,
    is_returnable: false,
    default_variant_id: null,
    default_sku: "WGT-001",
    barcode: null,
    selling_price: null,
    purchase_price: null,
    supplier_name: null,
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

  it("uses No SKU when SKU column is visible but empty", () => {
    const subline = buildCompactCardSubline({
      product: sampleRow({ default_sku: null, is_active: true }),
      showSku: true,
      showStatus: false,
    });

    expect(formatCompactCardSubline(subline!)).toBe("No SKU");
  });
});
