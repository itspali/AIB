import { describe, expect, it } from "vitest";
import { DEFAULT_PO_SCREEN_LAYOUT } from "@/lib/documents/purchase-order-layout";
import { patchPoLineTaxCodeSelection } from "@/lib/procurement/purchase-orders/po-line-tax-codes";
import {
  resolvePoDraftLineTaxAmountDisplay,
  resolvePoDraftLineTaxRateDisplay,
  shouldShowPoTaxRateUnderLineTaxColumn,
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

describe("po line tax layout", () => {
  it("stacks tax rate under line tax when Tax % column is hidden", () => {
    const layout = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "line_tax_amount" ? { ...column, defaultVisible: true } : column
      ),
    };

    expect(shouldShowPoTaxRateUnderLineTaxColumn(layout)).toBe(true);
  });

  it("keeps tax rate in its own column when Tax % is visible", () => {
    const layout = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "line_tax_amount" || column.id === "tax_rate_pct"
          ? { ...column, defaultVisible: true }
          : column
      ),
    };

    expect(shouldShowPoTaxRateUnderLineTaxColumn(layout)).toBe(false);
  });
});

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

  it("patches catalog tax rule from dropdown selection", () => {
    const taxOptions = [
      {
        id: "tax-12",
        code: "GST12",
        name: "GST 12%",
        rate: 12,
        kind: "GST",
        is_variable: false,
        components: [
          { name: "CGST", rate: 6, sort_order: 0 },
          { name: "SGST", rate: 6, sort_order: 1 },
        ],
      },
    ] as const;

    expect(patchPoLineTaxCodeSelection(baseLine, "tax-12", taxOptions as unknown as import("@/lib/procurement/purchase-orders/po-line-tax-codes").PoLineTaxCodeOption[])).toEqual({
      catalog_context: {
        ...baseLine.catalog_context,
        tax_code_id: "tax-12",
        tax_rate: 12,
        tax_is_variable: false,
        tax_components: [
          { name: "CGST", rate: 6, sort_order: 0 },
          { name: "SGST", rate: 6, sort_order: 1 },
        ],
      },
    });
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
