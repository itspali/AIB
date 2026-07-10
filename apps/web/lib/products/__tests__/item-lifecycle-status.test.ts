import { describe, expect, it } from "vitest";
import {
  resolveItemDetailLifecycleStatus,
  resolveItemListRowLifecycleStatus,
} from "@/lib/products/item-lifecycle-status";
import type { ProductDetailSnapshot, ProductListRow } from "@/lib/products/types";

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

describe("resolveItemListRowLifecycleStatus", () => {
  it("returns inactive when the item is inactive", () => {
    expect(resolveItemListRowLifecycleStatus(sampleRow({ is_active: false }), false)).toEqual({
      label: "Inactive",
      tone: "inactive",
    });
  });

  it("returns variant inactive when expanded and variant is inactive", () => {
    expect(
      resolveItemListRowLifecycleStatus(
        sampleRow({ variant_id: "v1", variant_is_active: false }),
        true
      )
    ).toEqual({
      label: "Variant inactive",
      tone: "inactive",
    });
  });

  it("returns active for a live item row", () => {
    expect(resolveItemListRowLifecycleStatus(sampleRow(), false)).toEqual({
      label: "Active",
      tone: "active",
    });
  });
});

describe("resolveItemDetailLifecycleStatus", () => {
  it("prefers needs review over active status", () => {
    const detail = {
      needs_review: true,
      status: "ACTIVE",
      is_active: true,
    } as ProductDetailSnapshot;

    expect(resolveItemDetailLifecycleStatus(detail, null)).toEqual({
      label: "Needs review",
      tone: "warning",
    });
  });

  it("maps draft lifecycle status to warning", () => {
    const detail = {
      status: "DRAFT",
      is_active: true,
    } as ProductDetailSnapshot;

    expect(resolveItemDetailLifecycleStatus(detail, null)).toEqual({
      label: "Draft",
      tone: "warning",
    });
  });
});
