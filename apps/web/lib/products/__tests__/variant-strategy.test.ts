import { describe, expect, it } from "vitest";
import {
  inferVariantStrategy,
  productListHasVariantsBadgeLabel,
} from "@/lib/products/variant-strategy";

describe("inferVariantStrategy", () => {
  it("returns MULTI_SKU when two or more sellable SKUs exist", () => {
    expect(
      inferVariantStrategy({ sellableVariantCount: 2, totalVariantRows: 2 })
    ).toBe("MULTI_SKU");
  });

  it("keeps MULTI_SKU with one sellable row when style has multiple rows", () => {
    expect(
      inferVariantStrategy({
        sellableVariantCount: 1,
        totalVariantRows: 3,
        persistedStrategy: "SINGLE_SKU",
      })
    ).toBe("MULTI_SKU");
  });

  it("returns SINGLE_SKU for one sellable row on a single-row item", () => {
    expect(
      inferVariantStrategy({ sellableVariantCount: 1, totalVariantRows: 1 })
    ).toBe("SINGLE_SKU");
  });

  it("preserves MULTI_SKU mid-setup before sellable rows exist", () => {
    expect(
      inferVariantStrategy({
        sellableVariantCount: 0,
        totalVariantRows: 0,
        persistedStrategy: "MULTI_SKU",
      })
    ).toBe("MULTI_SKU");
  });

  it("defaults to SINGLE_SKU when no sellable rows and no persisted multi", () => {
    expect(inferVariantStrategy({ sellableVariantCount: 0 })).toBe("SINGLE_SKU");
  });

  it("infers MULTI_SKU when variant axes are selected before sellable rows exist", () => {
    expect(
      inferVariantStrategy({
        sellableVariantCount: 0,
        selectedAxisCount: 2,
      })
    ).toBe("MULTI_SKU");
  });

  it("infers MULTI_SKU with one sellable master when axes are selected", () => {
    expect(
      inferVariantStrategy({
        sellableVariantCount: 1,
        totalVariantRows: 1,
        selectedAxisCount: 1,
      })
    ).toBe("MULTI_SKU");
  });
});

describe("productListHasVariantsBadgeLabel", () => {
  it("formats singular and plural sellable counts", () => {
    expect(productListHasVariantsBadgeLabel(1)).toBe("1 variant");
    expect(productListHasVariantsBadgeLabel(3)).toBe("3 variants");
  });

  it("falls back when count is missing or zero", () => {
    expect(productListHasVariantsBadgeLabel()).toBe("variants");
    expect(productListHasVariantsBadgeLabel(0)).toBe("variants");
    expect(productListHasVariantsBadgeLabel(null)).toBe("variants");
  });
});
