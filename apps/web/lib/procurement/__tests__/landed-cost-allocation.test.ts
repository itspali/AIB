import { describe, expect, it } from "vitest";
import {
  allocateExtraLandedPerUnit,
  computeFinalLandedUnitCost,
} from "@/lib/procurement/goods-receipts/landed-cost-allocation";

describe("landed cost allocation", () => {
  const lines = [
    { quantity_received: 10, quantity_accepted: 8, unit_cost: 100, weight_kg: 1 },
    { quantity_received: 5, quantity_accepted: 5, unit_cost: 50, weight_kg: 2 },
  ];

  it("allocates freight by value across accepted qty when sunk overhead off", () => {
    const extra = allocateExtraLandedPerUnit(lines[0], lines, 130, "BY_VALUE", false);
    const totalValue = 8 * 100 + 5 * 50;
    expect(extra).toBeCloseTo((130 * (8 * 100)) / totalValue / 8, 2);
  });

  it("allocates freight across full received when sunk overhead on", () => {
    const extra = allocateExtraLandedPerUnit(
      lines[0],
      lines,
      150,
      "BY_QUANTITY",
      true
    );
    expect(extra).toBeCloseTo((150 * 10) / 15 / 10, 4);
  });

  it("computes final landed unit cost", () => {
    expect(computeFinalLandedUnitCost(100, 5, 2, 3)).toBe(110);
  });
});
