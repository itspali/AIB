import { describe, expect, it } from "vitest";
import {
  PO_PRICES_TAX_MODE_LABEL,
  poPricesTaxInclusiveToMode,
  poPricesTaxModeToInclusive,
  resolvePoUnitPriceColumnLabel,
} from "@/lib/procurement/purchase-orders/po-line-tax-mode";

describe("po line tax mode", () => {
  it("maps inclusive flag to mode labels", () => {
    expect(poPricesTaxInclusiveToMode(false)).toBe("exclusive");
    expect(poPricesTaxInclusiveToMode(true)).toBe("inclusive");
    expect(PO_PRICES_TAX_MODE_LABEL.exclusive).toBe("Tax exclusive");
    expect(PO_PRICES_TAX_MODE_LABEL.inclusive).toBe("Tax inclusive");
  });

  it("converts mode back to inclusive flag", () => {
    expect(poPricesTaxModeToInclusive("exclusive")).toBe(false);
    expect(poPricesTaxModeToInclusive("inclusive")).toBe(true);
  });

  it("updates unit price column label for tax mode", () => {
    expect(resolvePoUnitPriceColumnLabel(false)).toBe("Offer price (ex tax)");
    expect(resolvePoUnitPriceColumnLabel(true)).toBe("Offer price (inc tax)");
  });
});
