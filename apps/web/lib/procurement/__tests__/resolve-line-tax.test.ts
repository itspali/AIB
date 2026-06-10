import { describe, expect, it } from "vitest";
import { resolveFlatLineTax } from "@/lib/tax/resolve-line-tax";

describe("resolveFlatLineTax", () => {
  it("adds exclusive tax on net line value", () => {
    const result = resolveFlatLineTax({
      qty: 2,
      unitPrice: 100,
      lineDiscount: 0,
      taxRate: 18,
      pricesTaxInclusive: false,
    });

    expect(result.taxableBase).toBe(200);
    expect(result.taxAmount).toBe(36);
    expect(result.lineTotal).toBe(236);
  });

  it("splits inclusive tax from gross line value", () => {
    const result = resolveFlatLineTax({
      qty: 1,
      unitPrice: 118,
      lineDiscount: 0,
      taxRate: 18,
      pricesTaxInclusive: true,
    });

    expect(result.taxableBase).toBe(100);
    expect(result.taxAmount).toBe(18);
    expect(result.lineTotal).toBe(118);
  });

  it("returns zero tax for variable codes on client preview", () => {
    const result = resolveFlatLineTax({
      qty: 1,
      unitPrice: 100,
      lineDiscount: 0,
      taxRate: 18,
      pricesTaxInclusive: false,
      taxIsVariable: true,
    });

    expect(result.taxAmount).toBe(0);
    expect(result.taxableBase).toBe(100);
  });
});
