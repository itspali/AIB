import { describe, expect, it } from "vitest";
import {
  productListVariantNameIndentClass,
  resolveProductListRowPresentation,
} from "@/lib/products/list-row-presentation";
import { injectVariantParentRows } from "@/lib/products/list-row-key";
import type { ProductListRow } from "@/lib/products/types";

function sampleRow(partial: Partial<ProductListRow> = {}): ProductListRow {
  return {
    id: "item-1",
    name: "Test Item",
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
    default_sku: "ITM001-L-BLUE",
    barcode: null,
    selling_price: null,
    mrp: null,
    purchase_price: null,
    supplier_name: null,
    stock_on_hand: "0",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    variant_id: "variant-1",
    variant_attributes: { size: "L", color: "Blue" },
    variant_is_active: true,
    variant_strategy: "MULTI_SKU",
    style_code: "ITM001",
    ...partial,
  };
}

describe("resolveProductListRowPresentation", () => {
  it("classifies expanded multi-SKU variant rows", () => {
    const presentation = resolveProductListRowPresentation(sampleRow(), true);

    expect(presentation.kind).toBe("variant");
    expect(presentation.isExpandedVariantRow).toBe(true);
    expect(presentation.attributeSubline).toBe("size: L · color: Blue");
    expect(presentation.displaySku).toBe("ITM001-L-BLUE");
    expect(presentation.showHasVariantsIndicator).toBe(false);
  });

  it("classifies collapsed multi-SKU master rows", () => {
    const presentation = resolveProductListRowPresentation(
      sampleRow({ variant_id: null, default_sku: "ITM001" }),
      false
    );

    expect(presentation.kind).toBe("style");
    expect(presentation.isStyleRow).toBe(true);
    expect(presentation.attributeSubline).toBeNull();
    expect(presentation.displaySku).toBe("ITM001");
    expect(presentation.showHasVariantsIndicator).toBe(true);
  });

  it("shows has variants indicator for multi-SKU style rows even when has_variants is false", () => {
    const presentation = resolveProductListRowPresentation(
      sampleRow({ variant_id: null, has_variants: false, default_sku: "ITM001" }),
      false
    );

    expect(presentation.kind).toBe("style");
    expect(presentation.showHasVariantsIndicator).toBe(true);
  });

  it("treats legacy has_variants rows as variant rows when expanded", () => {
    const presentation = resolveProductListRowPresentation(
      sampleRow({
        variant_strategy: "SINGLE_SKU",
        has_variants: true,
        variant_id: "variant-1",
        default_sku: "ITM001-L-BLUE",
        variant_attributes: { size: "L", color: "Blue" },
      }),
      true
    );

    expect(presentation.kind).toBe("variant");
    expect(presentation.isExpandedVariantRow).toBe(true);
    expect(presentation.attributeSubline).toBe("size: L · color: Blue");
    expect(presentation.displaySku).toBe("ITM001-L-BLUE");
    expect(presentation.showHasVariantsIndicator).toBe(false);
  });

  it("does not treat single-SKU items as variant rows when expanded", () => {
    const presentation = resolveProductListRowPresentation(
      sampleRow({
        has_variants: false,
        variant_strategy: "SINGLE_SKU",
        variant_id: "variant-1",
        default_sku: "SKU-ONLY",
        style_code: "ITM001",
        variant_attributes: { size: "L" },
      }),
      true
    );

    expect(presentation.kind).toBe("single");
    expect(presentation.isExpandedVariantRow).toBe(false);
    expect(presentation.attributeSubline).toBeNull();
    expect(presentation.displaySku).toBe("ITM001");
    expect(presentation.showHasVariantsIndicator).toBe(false);
  });
});

describe("productListVariantNameIndentClass", () => {
  it("indents only expanded variant rows in list view", () => {
    const variant = resolveProductListRowPresentation(sampleRow(), true);
    const single = resolveProductListRowPresentation(
      sampleRow({ has_variants: false, variant_strategy: "SINGLE_SKU" }),
      true
    );

    expect(productListVariantNameIndentClass(variant, true)).toBe(
      "pl-6 sm:pl-8 border-l-2 border-border/60 ml-2"
    );
    expect(productListVariantNameIndentClass(single, true)).toBeUndefined();
  });

  it("does not indent injected parent rows when variants are expanded", () => {
    const variant = sampleRow({
      variant_strategy: "MULTI_SKU",
      variant_id: "variant-1",
      style_code: "ITM001",
      default_sku: "ITM001-L",
    });
    const [parent] = injectVariantParentRows([variant]);
    const parentPresentation = resolveProductListRowPresentation(parent, true);

    expect(parentPresentation.showHasVariantsIndicator).toBe(true);
    expect(parentPresentation.isExpandedVariantRow).toBe(false);
    expect(parentPresentation.isProductGroupHeader).toBe(true);
    expect(productListVariantNameIndentClass(parentPresentation, true)).toBeUndefined();
  });
});
