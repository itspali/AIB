import { describe, expect, it } from "vitest";
import {
  filterProcurementLocationsByScope,
  preferredPurchaseOrderDestinationId,
  purchaseOrderScopeAllowsDestination,
  resolvePurchaseOrderLocationScope,
} from "@/lib/procurement/location-scope";

describe("resolvePurchaseOrderLocationScope", () => {
  it("allows all locations for owner and admin", () => {
    expect(resolvePurchaseOrderLocationScope({ role: "OWNER", assignedLocationId: null, delegateAllowedLocationIds: null })).toEqual({
      mode: "unrestricted",
    });
    expect(resolvePurchaseOrderLocationScope({ role: "ADMIN", assignedLocationId: null, delegateAllowedLocationIds: null })).toEqual({
      mode: "unrestricted",
    });
  });

  it("scopes branch users to assigned location", () => {
    expect(
      resolvePurchaseOrderLocationScope({
        role: "MANAGER",
        assignedLocationId: "loc-1",
        delegateAllowedLocationIds: null,
      })
    ).toEqual({ mode: "single", locationId: "loc-1" });
  });

  it("scopes delegates when allowed locations are listed", () => {
    expect(
      resolvePurchaseOrderLocationScope({
        role: "STAFF",
        assignedLocationId: "loc-1",
        delegateAllowedLocationIds: ["loc-a", "loc-b"],
      })
    ).toEqual({ mode: "list", locationIds: ["loc-a", "loc-b"] });
  });
});

describe("purchaseOrderScopeAllowsDestination", () => {
  it("checks single and list scopes", () => {
    expect(
      purchaseOrderScopeAllowsDestination({ mode: "single", locationId: "loc-1" }, "loc-1")
    ).toBe(true);
    expect(
      purchaseOrderScopeAllowsDestination({ mode: "single", locationId: "loc-1" }, "loc-2")
    ).toBe(false);
    expect(
      purchaseOrderScopeAllowsDestination({ mode: "list", locationIds: ["loc-a"] }, "loc-a")
    ).toBe(true);
  });
});

describe("filterProcurementLocationsByScope", () => {
  const locations = [
    { id: "loc-1", name: "One", code: "ONE" },
    { id: "loc-2", name: "Two", code: "TWO" },
  ];

  it("filters to assigned branch locations", () => {
    expect(
      filterProcurementLocationsByScope(locations, { mode: "single", locationId: "loc-2" })
    ).toEqual([locations[1]]);
  });

  it("prefers scoped default destination", () => {
    expect(
      preferredPurchaseOrderDestinationId(locations, { mode: "single", locationId: "loc-2" })
    ).toBe("loc-2");
  });
});
