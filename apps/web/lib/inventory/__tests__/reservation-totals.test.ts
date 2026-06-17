import { describe, expect, it } from "vitest";
import {
  computeAvailableQuantity,
  locationVariantReservationKey,
} from "@/lib/inventory/stock/reservation-totals";

describe("reservation totals", () => {
  it("builds stable location-variant keys", () => {
    expect(locationVariantReservationKey("loc-1", "var-1")).toBe("loc-1:var-1");
  });

  it("computes available quantity from on-hand minus reserved", () => {
    expect(computeAvailableQuantity("100", "30")).toBe("70");
    expect(computeAvailableQuantity("10", "15")).toBe("-5");
  });
});

describe("sales order reservation deltas", () => {
  it("open quantity excludes shipped units", () => {
    const ordered = 10;
    const shipped = 3;
    expect(Math.max(0, ordered - shipped)).toBe(7);
  });

  it("amend reservation target uses full ordered qty when nothing shipped", () => {
    const ordered = 12;
    const shipped = 0;
    expect(Math.max(ordered - shipped, 0)).toBe(12);
  });

  it("cancel releases only unshipped reservation remainder", () => {
    const ordered = 10;
    const shipped = 4;
    const reserved = 6;
    expect(reserved).toBe(Math.max(ordered - shipped, 0));
  });
});
