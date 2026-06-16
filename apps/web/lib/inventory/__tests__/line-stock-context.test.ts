import { describe, expect, it } from "vitest";
import { resolveDocumentLineStockBelowReorder } from "@/lib/inventory/stock/line-stock-context";

describe("resolveDocumentLineStockBelowReorder", () => {
  it("returns false when reorder point is unset", () => {
    expect(resolveDocumentLineStockBelowReorder("4", null)).toBe(false);
  });

  it("flags at or below reorder point", () => {
    expect(resolveDocumentLineStockBelowReorder("10", "10")).toBe(true);
    expect(resolveDocumentLineStockBelowReorder("9.5", "10")).toBe(true);
    expect(resolveDocumentLineStockBelowReorder("10.001", "10")).toBe(false);
  });
});
