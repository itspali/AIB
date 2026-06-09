import { describe, expect, it } from "vitest";
import { resolvePoPeekLineCellDisplay } from "@/lib/documents/peek-line-display";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";

const sampleLine: PurchaseOrderLineRow = {
  id: "line-1",
  item_id: "item-1",
  item_name: "Widget",
  variant_id: "variant-1",
  variant_sku: "SKU-1",
  quantity_ordered: "2.5",
  quantity_received: "1",
  unit_price_contractual: "12.567",
  line_total_gross: "31.4175",
  open_quantity: "1.5",
};

describe("resolvePoPeekLineCellDisplay", () => {
  it("formats numeric peek cells using column decimal places", () => {
    const unitPriceColumn: DocumentColumnPref = {
      id: "unit_price",
      label: "Unit price",
      defaultVisible: true,
      decimalPlaces: 2,
    };

    expect(resolvePoPeekLineCellDisplay(unitPriceColumn, sampleLine)).toBe("12.57");
  });

  it("returns null for unit column without persisted line data", () => {
    expect(
      resolvePoPeekLineCellDisplay(
        { id: "unit", label: "Unit", defaultVisible: true },
        sampleLine
      )
    ).toBeNull();
  });

  it("resolves sku from variant_sku", () => {
    expect(
      resolvePoPeekLineCellDisplay(
        { id: "sku", label: "SKU", defaultVisible: true },
        sampleLine
      )
    ).toBe("SKU-1");
  });
});
