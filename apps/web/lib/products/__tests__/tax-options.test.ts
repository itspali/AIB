import { describe, expect, it } from "vitest";
import {
  deriveDefaultTaxCategoryFromTaxCode,
  isTaxableSupplyCategory,
  normalizeTaxCategory,
  taxCategoryLabel,
} from "@/lib/products/tax-options";

describe("tax-options", () => {
  it("normalizes legacy rate buckets to supply categories", () => {
    expect(normalizeTaxCategory("STANDARD")).toBe("TAXABLE");
    expect(normalizeTaxCategory("EXEMPT")).toBe("NON_TAXABLE");
  });

  it("labels supply categories for the UI", () => {
    expect(taxCategoryLabel("NON_GST_SUPPLY")).toBe("Non-GST Supply");
    expect(taxCategoryLabel("OUT_OF_SCOPE")).toBe("Out of Scope");
  });

  it("detects taxable supply for HSN visibility", () => {
    expect(isTaxableSupplyCategory("TAXABLE")).toBe(true);
    expect(isTaxableSupplyCategory("NON_TAXABLE")).toBe(false);
  });

  it("maps tax codes to taxable supply by default", () => {
    expect(deriveDefaultTaxCategoryFromTaxCode(null)).toBe("TAXABLE");
    expect(deriveDefaultTaxCategoryFromTaxCode({ rate: 0, kind: "EXEMPT" })).toBe("NON_TAXABLE");
    expect(deriveDefaultTaxCategoryFromTaxCode({ rate: 18, kind: "GST" })).toBe("TAXABLE");
  });
});
