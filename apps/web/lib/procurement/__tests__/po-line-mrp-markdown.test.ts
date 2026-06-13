import { describe, expect, it } from "vitest";
import {
  computeImpliedMrpMarkdownPct,
  computeOfferUnitFromMrpMarkdown,
  hasPoLineMrpOverride,
  patchPoLineMrpMarkdownPercentage,
  patchPoLineOfferUnitPrice,
  patchPoLineOfferUnitPriceDraft,
  resolvePoLineMrpMarkdownPercentage,
  resolvePoLineMrpReferenceDisplay,
  resolvePoLineMrpVarianceDirection,
  shouldShowPoMrpTradeTermsStack,
  syncPoLineMrpMarkdownFromOfferPrice,
} from "@/lib/procurement/purchase-orders/po-line-mrp-markdown";
import { patchPoLineMrpReference, patchPoLineMrpReferenceDraft } from "@/components/procurement/purchase-orders/po-line-mrp-reference-slot";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";

const priceColumn = {
  id: "unit_price",
  label: "Unit price",
  defaultVisible: true,
  group: "line" as const,
  decimalPlaces: 2,
};

function sampleLine(partial: Partial<PoDraftLine> = {}): PoDraftLine {
  return {
    key: "line-1",
    sku: "SKU-1",
    variant_id: "variant-1",
    item_id: "item-1",
    item_name: "Widget",
    variant_sku: "SKU-1",
    quantity_ordered: "1",
    unit_price_contractual: "108",
    discount_percentage: "0",
    discount_amount: "0",
    skuError: null,
    catalog_context: {
      description: null,
      hsn_sac_code: null,
      base_unit_of_measure: "EA",
      mrp: "120",
      image_url: null,
      tax_code_id: null,
      tax_rate: 0,
      tax_is_variable: false,
      default_purchase_uom: null,
      alternate_uoms: [],
      custom_fields: {},
      variant_attributes: {},
      attribute_labels: {},
    },
    ...partial,
  };
}

describe("po-line-mrp-markdown", () => {
  it("derives offer unit from MRP markdown percent", () => {
    expect(computeOfferUnitFromMrpMarkdown(120, 10)).toBe("108.00");
  });

  it("derives implied markdown when offer unit is edited", () => {
    expect(computeImpliedMrpMarkdownPct(120, 108)).toBe("10.00");
  });

  it("derives negative markdown when offer exceeds MRP", () => {
    expect(computeImpliedMrpMarkdownPct(2000, 2200)).toBe("-10.00");
    expect(computeOfferUnitFromMrpMarkdown(2000, -10)).toBe("2200.00");
  });

  it("shows trade stack when MRP exists", () => {
    expect(shouldShowPoMrpTradeTermsStack(sampleLine())).toBe(true);
    expect(shouldShowPoMrpTradeTermsStack(sampleLine({ catalog_context: null }))).toBe(false);
  });

  it("updates offer unit when markdown percent changes", () => {
    expect(
      patchPoLineMrpMarkdownPercentage(sampleLine(), "15", priceColumn)
    ).toEqual({
      mrp_markdown_percentage: "15.00",
      unit_price_contractual: "102.00",
    });
  });

  it("preserves unit price when markdown blur matches implied percent (tab-through)", () => {
    const line = sampleLine({
      catalog_context: {
        ...sampleLine().catalog_context!,
        mrp: "3500",
      },
      unit_price_contractual: "3000.00",
      mrp_markdown_percentage: "14.29",
    });
    expect(computeImpliedMrpMarkdownPct(3500, 3000)).toBe("14.29");
    expect(computeOfferUnitFromMrpMarkdown(3500, 14.29)).toBe("2999.85");
    expect(patchPoLineMrpMarkdownPercentage(line, "14.29", priceColumn)).toEqual({
      mrp_markdown_percentage: "14.29",
      unit_price_contractual: "3000.00",
    });
  });

  it("recalculates unit price when markdown percent is explicitly changed", () => {
    const line = sampleLine({
      catalog_context: {
        ...sampleLine().catalog_context!,
        mrp: "3500",
      },
      unit_price_contractual: "3000.00",
      mrp_markdown_percentage: "14.29",
    });
    expect(patchPoLineMrpMarkdownPercentage(line, "15", priceColumn)).toEqual({
      mrp_markdown_percentage: "15.00",
      unit_price_contractual: "2975.00",
    });
  });

  it("updates markdown when offer unit changes", () => {
    expect(
      patchPoLineOfferUnitPrice(sampleLine({ unit_price_contractual: "96" }), "96", priceColumn)
    ).toEqual({
      unit_price_contractual: "96.00",
      mrp_markdown_percentage: "20.00",
    });
  });

  it("updates negative markdown when offer unit is above MRP", () => {
    expect(
      patchPoLineOfferUnitPrice(
        sampleLine({
          unit_price_contractual: "2200",
          catalog_context: {
            ...sampleLine().catalog_context!,
            mrp: "2000",
          },
        }),
        "2200",
        priceColumn
      )
    ).toEqual({
      unit_price_contractual: "2200.00",
      mrp_markdown_percentage: "-10.00",
    });
  });

  it("updates offer unit when negative markdown percent is entered", () => {
    expect(
      patchPoLineMrpMarkdownPercentage(
        sampleLine({
          catalog_context: {
            ...sampleLine().catalog_context!,
            mrp: "2000",
          },
        }),
        "-10",
        priceColumn
      )
    ).toEqual({
      mrp_markdown_percentage: "-10.00",
      unit_price_contractual: "2200.00",
    });
  });

  it("infers markdown from offer when explicit value is unset", () => {
    expect(resolvePoLineMrpMarkdownPercentage(sampleLine())).toBe("10.00");
  });

  it("syncs markdown after supplier price pre-fill", () => {
    expect(syncPoLineMrpMarkdownFromOfferPrice(sampleLine({ unit_price_contractual: "90" }))).toEqual({
      mrp_markdown_percentage: "25.00",
    });
  });

  it("keeps raw unit price while typing without padding decimals", () => {
    expect(patchPoLineOfferUnitPriceDraft(sampleLine(), "12.")).toEqual({
      unit_price_contractual: "12.",
      mrp_markdown_percentage: "90.00",
    });
    expect(patchPoLineOfferUnitPrice(sampleLine(), "12.5", priceColumn)).toEqual({
      unit_price_contractual: "12.50",
      mrp_markdown_percentage: "89.58",
    });
  });

  it("resolves offer-vs-MRP variance direction", () => {
    expect(resolvePoLineMrpVarianceDirection(120, 108)).toBe("below");
    expect(resolvePoLineMrpVarianceDirection(120, 125)).toBe("above");
    expect(resolvePoLineMrpVarianceDirection(120, 120)).toBeNull();
    expect(resolvePoLineMrpVarianceDirection(120, 0)).toBe("below");
  });

  it("treats zero offer price as 100% off MRP", () => {
    expect(computeImpliedMrpMarkdownPct(2000, 0)).toBe("100.00");
    expect(resolvePoLineMrpMarkdownPercentage(sampleLine({ unit_price_contractual: "0" }))).toBe(
      "100.00"
    );
    expect(
      patchPoLineOfferUnitPrice(sampleLine(), "0", priceColumn)
    ).toEqual({
      unit_price_contractual: "0.00",
      mrp_markdown_percentage: "100.00",
    });
    expect(syncPoLineMrpMarkdownFromOfferPrice(sampleLine({ unit_price_contractual: "0" }))).toEqual({
      mrp_markdown_percentage: "100.00",
    });
  });

  it("shows catalog MRP in the PO reference field until overridden", () => {
    expect(resolvePoLineMrpReferenceDisplay(sampleLine())).toBe("120.00");
    expect(hasPoLineMrpOverride(sampleLine())).toBe(false);
    expect(
      hasPoLineMrpOverride(sampleLine({ mrp_reference: "125" }))
    ).toBe(true);
  });

  it("clears PO MRP override when value matches catalog on blur", () => {
    expect(
      patchPoLineMrpReference(sampleLine(), "120", priceColumn)
    ).toEqual({
      mrp_reference: null,
      mrp_markdown_percentage: "10.00",
    });
    expect(
      patchPoLineMrpReference(sampleLine(), "125", priceColumn)
    ).toEqual({
      mrp_reference: "125.00",
      mrp_markdown_percentage: "13.60",
    });
  });

  it("keeps raw MRP input while typing without normalizing to catalog", () => {
    expect(patchPoLineMrpReferenceDraft(sampleLine(), "120.")).toEqual({
      mrp_reference: "120.",
      mrp_markdown_percentage: "10.00",
    });
    expect(
      patchPoLineMrpReferenceDraft(sampleLine({ mrp_reference: "120." }), "125")
    ).toEqual({
      mrp_reference: "125",
      mrp_markdown_percentage: "13.60",
    });
  });
});
