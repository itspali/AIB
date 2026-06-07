import { describe, expect, it } from "vitest";
import { validateReceiptLines } from "@/lib/inventory/transfers/receipt-validation";

describe("validateReceiptLines", () => {
  it("accepts a full receipt split", () => {
    expect(
      validateReceiptLines([
        {
          line_id: "line-1",
          variant_sku: "SKU-1",
          quantity_dispatched: "10",
          quantity_accepted: "8",
          quantity_damaged: "1",
          quantity_lost: "1",
        },
      ])
    ).toBeNull();
  });

  it("rejects totals above dispatched quantity", () => {
    expect(
      validateReceiptLines([
        {
          line_id: "line-1",
          quantity_dispatched: "5",
          quantity_accepted: "4",
          quantity_damaged: "2",
          quantity_lost: "0",
        },
      ])
    ).toContain("cannot exceed");
  });

  it("rejects incomplete receipt splits", () => {
    expect(
      validateReceiptLines([
        {
          line_id: "line-1",
          quantity_dispatched: "5",
          quantity_accepted: "4",
          quantity_damaged: "0",
          quantity_lost: "0",
        },
      ])
    ).toContain("Account for all dispatched units");
  });
});
