import { describe, expect, it } from "vitest";
import {
  formatSalesLineCatalogSellingReferenceForDocument,
  resolveSalesLineSellingMarkdownPercentage,
  syncSalesLineSellingMarkdownFromOfferPrice,
} from "@/lib/sales/shared/sales-line-selling-markdown";
import { emptyPoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import type { SalesCommerceLineBase } from "@/lib/sales/shared/sales-line-entry";

function sampleLine(
  overrides: Partial<SalesCommerceLineBase> = {}
): SalesCommerceLineBase {
  return {
    key: "line-1",
    sku: "",
    variant_id: "variant-1",
    item_id: "item-1",
    item_name: "Widget",
    variant_sku: "W-1",
    unit_price_selling: "100",
    discount_percentage: "0",
    discount_amount: "0",
    skuError: null,
    catalog_context: {
      ...emptyPoLineCatalogContext(),
      selling_price: "118",
      price_is_tax_inclusive: true,
      tax_rate: 18,
      tax_is_variable: false,
      base_unit_of_measure: "PCS",
      alternate_uoms: [],
    },
    ...overrides,
  };
}

describe("sales-line-selling-markdown", () => {
  it("shows catalog selling rate in document tax basis when prices are tax inclusive", () => {
    expect(
      formatSalesLineCatalogSellingReferenceForDocument(sampleLine(), true, 2)
    ).toBe("118.00");
    expect(
      formatSalesLineCatalogSellingReferenceForDocument(
        sampleLine({
          catalog_context: {
            ...sampleLine().catalog_context!,
            selling_price: "100",
            price_is_tax_inclusive: false,
          },
        }),
        true,
        2
      )
    ).toBe("118.00");
  });

  it("shows ex-tax catalog rate when document prices are tax exclusive", () => {
    expect(
      formatSalesLineCatalogSellingReferenceForDocument(sampleLine(), false, 2)
    ).toBe("100.00");
  });

  it("recomputes markdown percent when tax mode changes", () => {
    const exclusiveLine = sampleLine({ unit_price_selling: "90" });
    const inclusiveLine = sampleLine({ unit_price_selling: "106.20" });
    expect(resolveSalesLineSellingMarkdownPercentage(exclusiveLine, false)).toBe("10.00");
    expect(resolveSalesLineSellingMarkdownPercentage(inclusiveLine, true)).toBe("10.00");
    expect(
      syncSalesLineSellingMarkdownFromOfferPrice(
        sampleLine({
          unit_price_selling: "106.20",
          selling_markdown_percentage: "99.00",
        }),
        true
      )
    ).toEqual({ selling_markdown_percentage: "10.00" });
  });
});
