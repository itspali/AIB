import { describe, expect, it } from "vitest";
import type { DocumentColumnPref } from "@/lib/documents/types";
import { resolveSalesPeekLineCellDisplay } from "@/lib/sales/shared/sales-peek-line-display";

const sampleLine = {
  id: "line-1",
  item_name: "Widget",
  variant_id: "variant-1",
  variant_sku: "SKU-1",
  quantity_ordered: "2.5",
  unit_price_selling: "12.567",
  discount_percentage: "10",
  discount_amount: "0",
  line_tax_amount: "2.82",
  line_total_gross: "28.28",
  base_unit_of_measure: "PCS",
};

const displayOptions = {
  quantityField: "quantity_ordered" as const,
  lineTotalField: "line_total_gross" as const,
};

describe("resolveSalesPeekLineCellDisplay", () => {
  it("formats numeric peek cells using column decimal places", () => {
    const unitPriceColumn: DocumentColumnPref = {
      id: "unit_price",
      label: "Unit price",
      defaultVisible: true,
      decimalPlaces: 2,
    };

    expect(resolveSalesPeekLineCellDisplay(unitPriceColumn, sampleLine, displayOptions)).toBe(
      "12.57"
    );
  });

  it("returns saved base unit for unit column", () => {
    expect(
      resolveSalesPeekLineCellDisplay(
        { id: "unit", label: "Unit", defaultVisible: true },
        sampleLine,
        displayOptions
      )
    ).toBe("PCS");
  });

  it("returns discount entry with percent suffix", () => {
    expect(
      resolveSalesPeekLineCellDisplay(
        { id: "discount_pct", label: "Discount", defaultVisible: true, decimalPlaces: 2 },
        sampleLine,
        displayOptions
      )
    ).toBe("10.00%");
  });

  it("resolves sku from variant_sku", () => {
    expect(
      resolveSalesPeekLineCellDisplay(
        { id: "sku", label: "SKU", defaultVisible: true },
        sampleLine,
        displayOptions
      )
    ).toBe("SKU-1");
  });
});
