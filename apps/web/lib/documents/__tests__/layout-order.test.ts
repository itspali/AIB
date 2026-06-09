import { describe, expect, it } from "vitest";
import { mergeFieldOrder, moveFieldInOrder } from "@/lib/documents/layout-order";

describe("layout-order", () => {
  it("merges saved order with registry ids", () => {
    expect(mergeFieldOrder(["b", "a"], ["a", "b", "c"])).toEqual(["b", "a", "c"]);
  });

  it("moves fields and respects pinned ids", () => {
    const order = ["item", "quantity_ordered", "unit_price", "line_total"] as const;
    expect(
      moveFieldInOrder(order, "line_total", "quantity_ordered", { pinnedIds: ["item"] })
    ).toEqual(["item", "line_total", "quantity_ordered", "unit_price"]);
    expect(
      moveFieldInOrder(order, "item", "unit_price", { pinnedIds: ["item"] })
    ).toEqual([...order]);
  });
});
