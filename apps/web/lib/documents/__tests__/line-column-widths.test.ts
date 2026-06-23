import { describe, expect, it } from "vitest";
import {
  computeDocumentLineMinTableWidth,
  DOCUMENT_LINE_COMMERCIAL_MONEY_WIDTH_REM,
  DOCUMENT_LINE_DISCOUNT_PCT_WIDTH_REM,
  DOCUMENT_LINE_ITEM_COLUMN_MIN_WIDTH_REM,
  DOCUMENT_LINE_QTY_WIDTH_REM,
  DOCUMENT_LINE_UNIT_WIDTH_REM,
  getDocumentLineColumnMinWidthRem,
  getDocumentLineColumnWidthClass,
  getDocumentLineColumnWidthRem,
} from "@/lib/documents/line-column-widths";

describe("line-column-widths", () => {
  it("assigns compact fixed widths to auxiliary columns", () => {
    expect(getDocumentLineColumnWidthClass("unit")).toBe(
      `w-[${DOCUMENT_LINE_UNIT_WIDTH_REM}rem]`
    );
    expect(getDocumentLineColumnWidthRem("unit")).toBe(DOCUMENT_LINE_UNIT_WIDTH_REM);
    expect(getDocumentLineColumnWidthClass("item")).toBe("min-w-[16rem]");
    expect(getDocumentLineColumnWidthRem("item")).toBeUndefined();
    expect(getDocumentLineColumnMinWidthRem("item")).toBe(DOCUMENT_LINE_ITEM_COLUMN_MIN_WIDTH_REM);
  });

  it("sizes commercial numeric columns for grouped 9-digit money values", () => {
    expect(getDocumentLineColumnWidthRem("quantity_ordered")).toBe(DOCUMENT_LINE_QTY_WIDTH_REM);
    expect(getDocumentLineColumnWidthRem("unit_price")).toBe(
      DOCUMENT_LINE_COMMERCIAL_MONEY_WIDTH_REM
    );
    expect(getDocumentLineColumnWidthRem("line_total")).toBe(
      DOCUMENT_LINE_COMMERCIAL_MONEY_WIDTH_REM
    );
    expect(getDocumentLineColumnWidthRem("discount_pct")).toBe(
      DOCUMENT_LINE_DISCOUNT_PCT_WIDTH_REM
    );
    expect(getDocumentLineColumnWidthRem("discount_amount")).toBe(
      DOCUMENT_LINE_COMMERCIAL_MONEY_WIDTH_REM
    );
  });

  it("sizes GRN receipt columns compactly with a wider exception disposition column", () => {
    expect(getDocumentLineColumnWidthRem("quantity_received")).toBe(5.5);
    expect(getDocumentLineColumnWidthRem("exception_quantity")).toBe(7);
    expect(getDocumentLineColumnWidthRem("quantity_accepted")).toBe(6.5);
    expect(getDocumentLineColumnWidthRem("raw_unit_cost")).toBe(7.5);
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
