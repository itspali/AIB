import { describe, expect, it } from "vitest";
import {
  buildOpeningAdjustmentsByLocation,
  hasPendingOpeningStockEntries,
  isOpeningStockCellLocked,
  isOpeningStockEligibleVariant,
  openingStockCellKey,
  parseOpeningQuantity,
  resolveOpeningUnitCost,
} from "@/lib/products/opening-stock";

describe("opening-stock", () => {
  it("openingStockCellKey joins variant and location", () => {
    expect(openingStockCellKey("v1", "l1")).toBe("v1:l1");
  });

  it("parseOpeningQuantity rejects non-positive values", () => {
    expect(parseOpeningQuantity("")).toBeNull();
    expect(parseOpeningQuantity("0")).toBeNull();
    expect(parseOpeningQuantity("-2")).toBeNull();
    expect(parseOpeningQuantity("10")).toBe(10);
  });

  it("isOpeningStockCellLocked is true when on hand is positive", () => {
    expect(isOpeningStockCellLocked("0")).toBe(false);
    expect(isOpeningStockCellLocked("2.5")).toBe(true);
  });

  it("resolveOpeningUnitCost prefers variant purchase rate then item purchase rate", () => {
    expect(
      resolveOpeningUnitCost({
        variantPurchasePrice: "120",
        itemPurchasePrice: "100",
        standardCost: "80",
        averageCost: "50",
      })
    ).toBe("120");
    expect(
      resolveOpeningUnitCost({
        variantPurchasePrice: null,
        itemPurchasePrice: "100",
        standardCost: "80",
      })
    ).toBe("100");
    expect(
      resolveOpeningUnitCost({
        itemPurchasePrice: "0",
        standardCost: "80",
        averageCost: "50",
      })
    ).toBe("80");
  });

  it("isOpeningStockEligibleVariant excludes non-sellable style anchors", () => {
    expect(
      isOpeningStockEligibleVariant({ is_active: true, is_sellable: true })
    ).toBe(true);
    expect(
      isOpeningStockEligibleVariant({ is_active: true, is_sellable: false })
    ).toBe(false);
    expect(
      isOpeningStockEligibleVariant({ is_active: false, is_sellable: true })
    ).toBe(false);
  });

  it("buildOpeningAdjustmentsByLocation groups by location and skips invalid rows", () => {
    const grouped = buildOpeningAdjustmentsByLocation([
      {
        variant_id: "v1",
        location_id: "loc-a",
        quantity: "5",
        unit_cost: "100",
      },
      {
        variant_id: "v2",
        location_id: "loc-a",
        quantity: "2",
        unit_cost: "50",
      },
      {
        variant_id: "v3",
        location_id: "loc-b",
        quantity: "1",
        unit_cost: "10",
      },
      {
        variant_id: "v4",
        location_id: "loc-b",
        quantity: "3",
        unit_cost: "0",
      },
    ]);

    expect(grouped.size).toBe(2);
    expect(grouped.get("loc-a")).toEqual([
      { variant_id: "v1", quantity_delta: 5, unit_cost: 100 },
      { variant_id: "v2", quantity_delta: 2, unit_cost: 50 },
    ]);
    expect(grouped.get("loc-b")).toEqual([
      { variant_id: "v3", quantity_delta: 1, unit_cost: 10 },
    ]);
  });

  it("hasPendingOpeningStockEntries reflects grouped output", () => {
    expect(
      hasPendingOpeningStockEntries([
        { variant_id: "v1", location_id: "l1", quantity: "", unit_cost: "1" },
      ])
    ).toBe(false);
    expect(
      hasPendingOpeningStockEntries([
        { variant_id: "v1", location_id: "l1", quantity: "2", unit_cost: "1" },
      ])
    ).toBe(true);
  });
});
