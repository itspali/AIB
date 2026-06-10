import { describe, expect, it } from "vitest";
import {
  resolvePoDraftLineTaxAmountDisplay,
  resolvePoDraftLineTaxRateDisplay,
} from "@/lib/procurement/purchase-orders/po-line-tax";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import { emptyPoLineCatalogContext } from "@/lib/documents/catalog-line-values";

const baseLine: PoDraftLine = {
  key: "line-1",
  sku: "SKU-1",
  variant_id: "variant-1",
  item_id: "item-1",
  item_name: "Widget",
  variant_sku: "SKU-1",
  quantity_ordered: "2",
  unit_price_contractual: "100",
  discount_percentage: "0",
  discount_amount: "0",
  skuError: null,
  catalog_context: {
    ...emptyPoLineCatalogContext(),
    tax_rate: 18,
    tax_is_variable: false,
  },
};

describe("po line tax display", () => {
  it("formats draft tax rate with percent suffix", () => {
    expect(
      resolvePoDraftLineTaxRateDisplay(baseLine, {
        id: "tax_rate_pct",
        label: "Tax %",
        defaultVisible: true,
        decimalPlaces: 2,
      })
    ).toBe("18.00%");
  });

  it("computes draft line tax amount from catalog rate", () => {
    expect(
      resolvePoDraftLineTaxAmountDisplay(
        baseLine,
        { id: "line_tax_amount", label: "Line tax", defaultVisible: true, decimalPlaces: 2 },
        { purchasePricesTaxInclusive: false }
      )
    ).toBe("36.00");
  });

  it("shows Variable for variable tax codes", () => {
    expect(
      resolvePoDraftLineTaxRateDisplay(
        {
          ...baseLine,
          catalog_context: {
            ...emptyPoLineCatalogContext(),
            tax_rate: 18,
            tax_is_variable: true,
          },
        },
        { id: "tax_rate_pct", label: "Tax %", defaultVisible: true, decimalPlaces: 2 }
      )
    ).toBe("Variable");
  });
});
