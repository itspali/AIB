import { describe, expect, it } from "vitest";
import {
  attachLedgerEntryBalances,
  resolveFetchLimit,
} from "@/lib/inventory/stock/ledger-history";

const baseEntry = {
  id: "1",
  variant_id: "var-1",
  transaction_type: "INVENTORY_ADJUSTMENT",
  cost_at_transaction: "10",
  reference_document: "SA-001",
  created_at: "2026-06-01T10:00:00.000Z",
};

describe("attachLedgerEntryBalances", () => {
  it("computes balance after each row from current on-hand (newest first)", () => {
    const entries = attachLedgerEntryBalances(
      [
        { ...baseEntry, id: "c", quantity: "-2", created_at: "2026-06-03T10:00:00.000Z" },
        { ...baseEntry, id: "b", quantity: "3", created_at: "2026-06-02T10:00:00.000Z" },
        { ...baseEntry, id: "a", quantity: "5", created_at: "2026-06-01T10:00:00.000Z" },
      ],
      6
    );

    expect(entries.map((row) => row.balance_after)).toEqual(["6", "8", "5"]);
  });

  it("defaults invalid on-hand to zero", () => {
    const entries = attachLedgerEntryBalances(
      [{ ...baseEntry, quantity: "4" }],
      "not-a-number"
    );

    expect(entries[0]?.balance_after).toBe("0");
  });
});

describe("resolveFetchLimit", () => {
  it("scales with variant count instead of always fetching 250 rows", () => {
    expect(resolveFetchLimit(1, 15)).toBe(15);
    expect(resolveFetchLimit(3, 15)).toBe(45);
    expect(resolveFetchLimit(20, 15)).toBe(250);
  });
});
