import { describe, expect, it } from "vitest";
import {
  computeDocumentLineMinTableWidth,
  DOCUMENT_LINE_ITEM_COLUMN_MIN_WIDTH_REM,
  getDocumentLineColumnMinWidthRem,
  getDocumentLineColumnWidthClass,
  getDocumentLineColumnWidthRem,
} from "@/lib/documents/line-column-widths";

describe("line-column-widths", () => {
  it("assigns compact fixed widths to auxiliary columns", () => {
    expect(getDocumentLineColumnWidthClass("unit")).toBe("w-[3.25rem]");
    expect(getDocumentLineColumnWidthRem("unit")).toBe(3.25);
    expect(getDocumentLineColumnWidthClass("item")).toBe("min-w-[16rem]");
    expect(getDocumentLineColumnWidthRem("item")).toBeUndefined();
    expect(getDocumentLineColumnMinWidthRem("item")).toBe(DOCUMENT_LINE_ITEM_COLUMN_MIN_WIDTH_REM);
  });

  it("grows min table width when optional columns are enabled", () => {
    const base = computeDocumentLineMinTableWidth(["item", "quantity_ordered", "unit_price", "line_total"]);
    const withUnit = computeDocumentLineMinTableWidth([
      "item",
      "unit",
      "quantity_ordered",
      "unit_price",
      "line_total",
    ]);
    expect(parseInt(withUnit.match(/\d+/)?.[0] ?? "0", 10)).toBeGreaterThan(
      parseInt(base.match(/\d+/)?.[0] ?? "0", 10)
    );
  });
});
