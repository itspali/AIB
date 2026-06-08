import { describe, expect, it } from "vitest";
import {
  STOCK_STYLE_ANCHOR_BLOCKED_REASON,
  isStockVariantAdjustable,
  resolveStockVariantBlockedReason,
} from "@/lib/inventory/stock/variant-eligibility";

describe("stock variant eligibility", () => {
  it("allows single-SKU master variants (sellable, quantity-tracked)", () => {
    expect(
      resolveStockVariantBlockedReason({
        is_sellable: true,
        track_inventory: true,
        tracking_mode: "NONE",
      })
    ).toBeNull();
    expect(
      isStockVariantAdjustable({
        is_sellable: true,
        track_inventory: true,
        tracking_mode: "NONE",
      })
    ).toBe(true);
  });

  it("blocks multi-SKU style anchors (non-sellable master)", () => {
    expect(
      resolveStockVariantBlockedReason({
        is_sellable: false,
        track_inventory: true,
        tracking_mode: "NONE",
      })
    ).toBe(STOCK_STYLE_ANCHOR_BLOCKED_REASON);
  });

  it("blocks variants when inventory tracking is off", () => {
    expect(
      resolveStockVariantBlockedReason({
        is_sellable: true,
        track_inventory: false,
        tracking_mode: "NONE",
      })
    ).toBe("Item does not track inventory.");
  });

  it("blocks lot and serial tracking modes", () => {
    expect(
      resolveStockVariantBlockedReason({
        is_sellable: true,
        track_inventory: true,
        tracking_mode: "LOT",
      })
    ).toContain("Lot tracking");

    expect(
      resolveStockVariantBlockedReason({
        is_sellable: true,
        track_inventory: true,
        tracking_mode: "SERIAL",
      })
    ).toContain("Serial tracking");
  });
});
