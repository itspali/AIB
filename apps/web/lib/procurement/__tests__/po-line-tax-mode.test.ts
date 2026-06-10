import { describe, expect, it } from "vitest";
import {
  PO_PRICES_TAX_MODE_LABEL,
  poPricesTaxInclusiveToMode,
  poPricesTaxModeToInclusive,
  resolvePoLineTotalPrimaryAmount,
  resolvePoUnitPriceColumnLabel,
  resolvePoUnitPriceColumnLabelFromLayout,
  shouldShowPoLineTotalExTaxSubline,
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

  it("uses layout label for unit price and swaps ex/inc suffix when present", () => {
    expect(
      resolvePoUnitPriceColumnLabelFromLayout("Offer price (ex tax)", true)
    ).toBe("Offer price (inc tax)");
    expect(
      resolvePoUnitPriceColumnLabelFromLayout("Offer price (inc tax)", false)
    ).toBe("Offer price (ex tax)");
    expect(resolvePoUnitPriceColumnLabelFromLayout("Contract rate", true)).toBe(
      "Contract rate"
    );
  });

  it("shows ex tax subline when line tax is computed", () => {
    const line = {
      variant_id: "variant-1",
      catalog_context: { tax_is_variable: false },
    };

    expect(
      shouldShowPoLineTotalExTaxSubline(line, { taxRate: 18, taxAmount: 234 })
    ).toBe(true);
    expect(
      shouldShowPoLineTotalExTaxSubline(line, { taxRate: 0, taxAmount: 0 })
    ).toBe(false);
    expect(
      shouldShowPoLineTotalExTaxSubline(
        { variant_id: "variant-1", catalog_context: { tax_is_variable: true } },
        { taxRate: 18, taxAmount: 234 }
      )
    ).toBe(false);
  });

  it("uses inc-tax line total as primary when ex tax subline is shown", () => {
    expect(
      resolvePoLineTotalPrimaryAmount(
        { taxableBase: 1300, taxAmount: 234, lineTotal: 1534 },
        true
      )
    ).toBe(1534);
    expect(
      resolvePoLineTotalPrimaryAmount(
        { taxableBase: 1300, taxAmount: 234, lineTotal: 1534 },
        false
      )
    ).toBe(1300);
  });
});
