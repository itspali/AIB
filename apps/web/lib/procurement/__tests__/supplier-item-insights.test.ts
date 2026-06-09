import { describe, expect, it } from "vitest";
import { compareLinePriceToCatalog } from "@/lib/procurement/purchase-orders/supplier-item-insights";

describe("compareLinePriceToCatalog", () => {
  it("returns match label when prices align", () => {
    expect(compareLinePriceToCatalog("120", "120")).toEqual({
      delta: 0,
      label: "Matches catalog",
    });
  });

  it("returns percent delta when line price differs", () => {
    expect(compareLinePriceToCatalog("125", "100").label).toBe("+25.0% vs catalog");
    expect(compareLinePriceToCatalog("90", "100").label).toBe("-10.0% vs catalog");
  });

  it("returns null when catalog price is missing", () => {
    expect(compareLinePriceToCatalog("100", null)).toEqual({ delta: null, label: null });
  });
});
