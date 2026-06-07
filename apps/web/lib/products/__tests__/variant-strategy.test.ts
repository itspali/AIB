import { describe, expect, it } from "vitest";
import { productListHasVariantsBadgeLabel } from "@/lib/products/variant-strategy";

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
