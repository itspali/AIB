import { describe, expect, it } from "vitest";
import { computeLineGross, computePurchaseOrderTotals } from "@/lib/procurement/purchase-orders/totals";

describe("purchase order totals", () => {
  it("sums line gross amounts for valid qty and price", () => {
    const totals = computePurchaseOrderTotals([
      { quantity_ordered: "2", unit_price_contractual: "10" },
      { quantity_ordered: "1.5", unit_price_contractual: "4" },
    ]);

    expect(totals.subtotalGross).toBe(26);
    expect(totals.grandTotal).toBe(26);
    expect(totals.filledLineCount).toBe(2);
  });

  it("returns zero for empty qty", () => {
    expect(computeLineGross({ quantity_ordered: "", unit_price_contractual: "12" })).toBe(0);
  });
});
