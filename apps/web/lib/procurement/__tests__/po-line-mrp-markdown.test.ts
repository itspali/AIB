import { describe, expect, it } from "vitest";
import {
  computeImpliedMrpMarkdownPct,
  computeOfferUnitFromMrpMarkdown,
  patchPoLineMrpMarkdownPercentage,
  patchPoLineOfferUnitPrice,
  patchPoLineOfferUnitPriceDraft,
  resolvePoLineMrpMarkdownPercentage,
  shouldShowPoMrpTradeTermsStack,
  syncPoLineMrpMarkdownFromOfferPrice,
} from "@/lib/procurement/purchase-orders/po-line-mrp-markdown";
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

  it("updates markdown when offer unit changes", () => {
    expect(
      patchPoLineOfferUnitPrice(sampleLine({ unit_price_contractual: "96" }), "96", priceColumn)
    ).toEqual({
      unit_price_contractual: "96.00",
      mrp_markdown_percentage: "20.00",
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

  it("treats zero offer price as unset markdown, not 100% off MRP", () => {
    expect(computeImpliedMrpMarkdownPct(2000, 0)).toBe("0");
    expect(resolvePoLineMrpMarkdownPercentage(sampleLine({ unit_price_contractual: "0" }))).toBe(
      "0"
    );
    expect(syncPoLineMrpMarkdownFromOfferPrice(sampleLine({ unit_price_contractual: "0" }))).toEqual({
      mrp_markdown_percentage: "0",
    });
  });
});
