import { describe, expect, it } from "vitest";
import {
  aggregateSubcontractConsumptionQty,
  shouldSkipSubcontractBackflush,
} from "@/lib/procurement/subcontract/grn-preview";

describe("subcontract backflush helpers", () => {
  it("skips backflush when PO is not flagged as subcontract job", () => {
    expect(shouldSkipSubcontractBackflush(false)).toBe(true);
    expect(shouldSkipSubcontractBackflush(true)).toBe(false);
  });

  it("computes consumption as accepted qty times BOM quantity per", () => {
    expect(aggregateSubcontractConsumptionQty(50, 1)).toBe(50);
    expect(aggregateSubcontractConsumptionQty(50, 1.5)).toBe(75);
    expect(aggregateSubcontractConsumptionQty(3, 0.3333)).toBe(0.9999);
  });
});
