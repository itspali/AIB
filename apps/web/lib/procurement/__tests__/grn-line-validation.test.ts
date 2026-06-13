import { describe, expect, it } from "vitest";
import {
  computeGrnLineQuantities,
  defaultGrnExceptionForReceived,
  isGrnExceptionInvalid,
  syncGrnQuantitiesOnExceptionChange,
  syncGrnQuantitiesOnReceivedChange,
  validateGrnExceptionLines,
} from "@/lib/procurement/goods-receipts/grn-line-validation";
import { resolveDefaultRouteToQc } from "@/lib/procurement/qc-receipt-policy";

describe("GRN exception quantity helpers", () => {
  it("computes accepted from received minus exceptions", () => {
    expect(computeGrnLineQuantities("10", "2")).toEqual({
      quantity_accepted: "8",
      quantity_rejected: "2",
    });
  });

  it("defaults exceptions to zero", () => {
    expect(defaultGrnExceptionForReceived("5")).toEqual({
      exception_quantity: "0",
      quantity_accepted: "5",
      quantity_rejected: "0",
    });
  });

  it("rejects exceptions above received", () => {
    expect(
      validateGrnExceptionLines([
        { quantity_received: "5", exception_quantity: "6", variant_sku: "SKU-1" },
      ])
    ).toMatch(/cannot exceed/i);
    expect(isGrnExceptionInvalid("5", "6")).toBe(true);
  });

  it("syncs quantities when received changes", () => {
    expect(
      syncGrnQuantitiesOnReceivedChange(
        { quantity_received: "10", exception_quantity: "0" },
        "12"
      )
    ).toEqual({
      quantity_received: "12",
      exception_quantity: "0",
      quantity_accepted: "12",
      quantity_rejected: "0",
    });
  });

  it("syncs accepted when exceptions change", () => {
    expect(syncGrnQuantitiesOnExceptionChange("10", "3")).toEqual({
      exception_quantity: "3",
      quantity_accepted: "7",
      quantity_rejected: "3",
    });
  });
});

describe("QC receipt policy resolution", () => {
  it("honours category required when QC module is enabled", () => {
    expect(
      resolveDefaultRouteToQc(
        { qcModuleEnabled: true, allowLineOverride: true, orgDefaultRouteToQc: false },
        { item_policy: "INHERIT", category_policy: "REQUIRED" }
      )
    ).toBe(true);
  });

  it("skips QC when module disabled", () => {
    expect(
      resolveDefaultRouteToQc(
        { qcModuleEnabled: false, allowLineOverride: true, orgDefaultRouteToQc: true },
        { item_policy: "REQUIRED", category_policy: "REQUIRED" }
      )
    ).toBe(false);
  });
});
