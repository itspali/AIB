import { describe, expect, it } from "vitest";
import {
  isBelowReorderThreshold,
  resolveStockStatus,
  valuationsBelowReorder,
} from "@/lib/products/stock-status";

describe("stock-status", () => {
  it("marks out of stock at zero", () => {
    expect(resolveStockStatus({ stockOnHand: "0" })).toEqual({
      label: "Out of stock",
      status: "out_of_stock",
    });
  });

  it("uses belowReorder from list view when provided", () => {
    expect(
      resolveStockStatus({
        stockOnHand: "42",
        belowReorder: true,
      })
    ).toEqual({
      label: "42 in stock",
      status: "low_stock",
    });
  });

  it("compares stock to reorder point when belowReorder is absent", () => {
    expect(
      resolveStockStatus({
        stockOnHand: "8",
        reorderPoint: "10",
      })
    ).toEqual({
      label: "8 in stock",
      status: "low_stock",
    });

    expect(
      resolveStockStatus({
        stockOnHand: "12",
        reorderPoint: "10",
      })
    ).toEqual({
      label: "12 in stock",
      status: "in_stock",
    });
  });

  it("ignores zero reorder point for low-stock", () => {
    expect(
      resolveStockStatus({
        stockOnHand: "3",
        reorderPoint: "0",
      })
    ).toEqual({
      label: "3 in stock",
      status: "in_stock",
    });
  });

  it("evaluates per-location valuations against default reorder", () => {
    expect(
      valuationsBelowReorder(
        [
          { total_quantity_on_hand: "20" },
          { total_quantity_on_hand: "4" },
        ],
        "10"
      )
    ).toBe(true);
    expect(isBelowReorderThreshold("4", "10")).toBe(true);
    expect(isBelowReorderThreshold("0", "10")).toBe(false);
  });
});
