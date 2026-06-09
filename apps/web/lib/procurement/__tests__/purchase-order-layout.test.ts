import { describe, expect, it } from "vitest";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getCompactPoTableColumns,
  getNestedUnderItemPoLineColumns,
  getVisiblePoLineColumns,
} from "@/lib/documents/purchase-order-layout";

describe("purchase-order-layout compact columns", () => {
  it("splits visible columns into primary table vs nested-under-item", () => {
    const visible = getVisiblePoLineColumns(DEFAULT_PO_SCREEN_LAYOUT);
    const primary = getCompactPoTableColumns(DEFAULT_PO_SCREEN_LAYOUT);
    const nested = getNestedUnderItemPoLineColumns(DEFAULT_PO_SCREEN_LAYOUT);

    expect(primary.map((column) => column.id)).toEqual([
      "item",
      "quantity_ordered",
      "unit_price",
      "line_total",
    ]);
    expect(nested.map((column) => column.id)).toEqual([]);
    expect(primary.length + nested.length).toBe(visible.length);
  });

  it("nests optional visible columns under item", () => {
    const layout = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "unit" ? { ...column, defaultVisible: true } : column
      ),
    };

    expect(getNestedUnderItemPoLineColumns(layout).map((column) => column.id)).toEqual(["unit"]);
    expect(getCompactPoTableColumns(layout).map((column) => column.id)).toEqual([
      "item",
      "quantity_ordered",
      "unit_price",
      "line_total",
    ]);
  });
});
