import { describe, expect, it } from "vitest";
import { sortStockBalanceRows } from "@/lib/inventory/stock/list-sort";
import type { StockBalanceRow } from "@/lib/inventory/stock/types";

function balance(partial: Partial<StockBalanceRow> & Pick<StockBalanceRow, "id">): StockBalanceRow {
  return {
    location_id: "loc-1",
    location_name: "Warehouse",
    location_code: "WH",
    item_id: "item-1",
    item_name: "Widget",
    variant_id: "var-1",
    variant_sku: "SKU-1",
    base_unit_of_measure: "PCS",
    total_quantity_on_hand: "10",
    current_average_cost: "5",
    reorder_point: "2",
    below_reorder: false,
    ...partial,
  };
}

describe("sortStockBalanceRows", () => {
  it("sorts by item name ascending", () => {
    const rows = [
      balance({ id: "1", item_name: "Zebra" }),
      balance({ id: "2", item_name: "Alpha" }),
    ];
    const sorted = sortStockBalanceRows(rows, "item", "asc");
    expect(sorted.map((row) => row.item_name)).toEqual(["Alpha", "Zebra"]);
  });

  it("sorts on hand descending", () => {
    const rows = [
      balance({ id: "1", total_quantity_on_hand: "1" }),
      balance({ id: "2", total_quantity_on_hand: "99" }),
    ];
    const sorted = sortStockBalanceRows(rows, "on_hand", "desc");
    expect(sorted.map((row) => row.total_quantity_on_hand)).toEqual(["99", "1"]);
  });
});
