import { describe, expect, it } from "vitest";
import {
  countTransferLinesExceedingOnHand,
  transferQuantityExceedsOnHand,
} from "@/lib/inventory/transfers/draft-quantity-hints";
import type { DocumentLineStockContext } from "@/lib/inventory/stock/line-stock-context";

const stockContext = (onHand: string): DocumentLineStockContext => ({
  quantity_on_hand: onHand,
  quantity_available: onHand,
  base_unit_of_measure: "PCS",
  reorder_point: null,
  below_reorder: false,
});

describe("transferQuantityExceedsOnHand", () => {
  it("returns false when quantity is within on-hand", () => {
    expect(transferQuantityExceedsOnHand("5", stockContext("10"))).toBe(false);
  });

  it("returns true when quantity exceeds on-hand", () => {
    expect(transferQuantityExceedsOnHand("11", stockContext("10"))).toBe(true);
  });

  it("returns false without stock context", () => {
    expect(transferQuantityExceedsOnHand("5", null)).toBe(false);
  });
});

describe("countTransferLinesExceedingOnHand", () => {
  it("counts only complete lines above on-hand", () => {
    const count = countTransferLinesExceedingOnHand(
      [
        { variant_id: "v1", quantity_dispatched: "12" },
        { variant_id: "v2", quantity_dispatched: "4" },
        { variant_id: "", quantity_dispatched: "99" },
      ],
      (variantId) => (variantId === "v1" ? stockContext("10") : stockContext("10"))
    );

    expect(count).toBe(1);
  });
});
