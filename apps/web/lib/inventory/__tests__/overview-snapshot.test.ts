import { describe, expect, it } from "vitest";
import { buildInventoryOverviewSnapshot } from "@/lib/inventory/overview/queries";
import type { StockAdjustmentRow, StockBalanceRow } from "@/lib/inventory/stock/types";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";

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
    quantity_reserved: "0",
    quantity_available: "0",
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

function transfer(partial: Partial<StockTransferRow>): StockTransferRow {
  return {
    id: "tr-1",
    transfer_number: "ST-001",
    source_location_id: "loc-1",
    source_location_name: "Main",
    source_location_code: "MAIN",
    destination_location_id: "loc-2",
    destination_location_name: "Branch",
    destination_location_code: "BR",
    current_status: "DRAFT",
    line_count: 1,
    inter_company_freight_cost: "0",
    loading_overhead_cost: "0",
    unloading_overhead_cost: "0",
    dispatched_at: null,
    received_at: null,
    created_at: "2026-06-07T09:00:00.000Z",
    ...partial,
  };
}

describe("buildInventoryOverviewSnapshot", () => {
  it("aggregates valuation, reorder, transfers, and recent activity", () => {
    const snapshot = buildInventoryOverviewSnapshot(
      [
        balance({
          total_quantity_on_hand: "10",
          current_average_cost: "5",
          below_reorder: true,
        }),
        balance({
          id: "b2",
          location_id: "loc-2",
          location_name: "Branch",
          variant_id: "var-1",
          total_quantity_on_hand: "20",
          current_average_cost: "5",
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
      ],
      [
        transfer({ id: "tr-1", current_status: "DISPATCHED_IN_TRANSIT" }),
        transfer({ id: "tr-2", transfer_number: "ST-002", current_status: "DRAFT" }),
      ]
    );

    expect(snapshot.inventoryValuation).toBe(150);
    expect(snapshot.belowReorderCount).toBe(1);
    expect(snapshot.stockedBalanceCount).toBe(2);
    expect(snapshot.inTransitTransferCount).toBe(1);
    expect(snapshot.belowReorderBalances).toHaveLength(1);
    expect(snapshot.belowReorderBalances[0]?.suggested_source_location_id).toBe("loc-2");
    expect(snapshot.recentTransfers).toHaveLength(2);
    expect(snapshot.recentAdjustments).toHaveLength(2);
  });
});
