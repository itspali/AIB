import { describe, expect, it } from "vitest";
import { buildInventoryOverviewSnapshot } from "@/lib/inventory/overview/queries";
import type { StockAdjustmentRow, StockBalanceRow } from "@/lib/inventory/stock/types";

function balance(partial: Partial<StockBalanceRow>): StockBalanceRow {
  return {
    id: "b1",
    location_id: "loc-1",
    location_name: "Main",
    location_code: "MAIN",
    item_id: "item-1",
    item_name: "Widget",
    variant_id: "var-1",
    variant_sku: "W-1",
    base_unit_of_measure: "EA",
    total_quantity_on_hand: "0",
    current_average_cost: "0",
    reorder_point: null,
    below_reorder: false,
    ...partial,
  };
}

function adjustment(partial: Partial<StockAdjustmentRow>): StockAdjustmentRow {
  return {
    id: "adj-1",
    location_id: "loc-1",
    location_name: "Main",
    location_code: "MAIN",
    adjustment_number: "SA-001",
    kind: "CORRECTION",
    reason: "Count",
    notes: null,
    posted_at: "2026-06-07T10:00:00.000Z",
    line_count: 1,
    ...partial,
  };
}

describe("buildInventoryOverviewSnapshot", () => {
  it("aggregates valuation, reorder, and recent adjustments", () => {
    const snapshot = buildInventoryOverviewSnapshot(
      [
        balance({
          total_quantity_on_hand: "10",
          current_average_cost: "5",
          below_reorder: true,
        }),
        balance({
          id: "b2",
          variant_id: "var-2",
          total_quantity_on_hand: "2",
          current_average_cost: "20",
        }),
        balance({
          id: "b3",
          variant_id: "var-3",
          total_quantity_on_hand: "0",
          current_average_cost: "15",
        }),
      ],
      [
        adjustment({ id: "adj-1", adjustment_number: "SA-001" }),
        adjustment({ id: "adj-2", adjustment_number: "SA-002" }),
      ]
    );

    expect(snapshot.inventoryValuation).toBe(90);
    expect(snapshot.belowReorderCount).toBe(1);
    expect(snapshot.stockedBalanceCount).toBe(2);
    expect(snapshot.recentAdjustments).toHaveLength(2);
  });
});
