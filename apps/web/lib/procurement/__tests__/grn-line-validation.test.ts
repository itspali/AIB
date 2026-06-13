import { describe, expect, it } from "vitest";
import {
  defaultGrnAcceptRejectForReceived,
  syncGrnAcceptRejectOnReceivedChange,
  validateGrnAcceptRejectLines,
} from "@/lib/procurement/goods-receipts/grn-line-validation";

describe("validateGrnAcceptRejectLines", () => {
  it("passes when accepted plus rejected equals received", () => {
    expect(
      validateGrnAcceptRejectLines([
        {
          variant_sku: "SKU-1",
          quantity_received: "10",
          quantity_accepted: "8",
          quantity_rejected: "2",
        },
      ])
    ).toBeNull();
  });

  it("fails when totals do not match received", () => {
    expect(
      validateGrnAcceptRejectLines([
        {
          variant_sku: "SKU-1",
          quantity_received: "10",
          quantity_accepted: "7",
          quantity_rejected: "2",
        },
      ])
    ).toMatch(/must equal received/i);
  });
});

describe("syncGrnAcceptRejectOnReceivedChange", () => {
  it("keeps accepted in sync when line was fully accepted", () => {
    expect(
      syncGrnAcceptRejectOnReceivedChange(
        {
          quantity_received: "10",
          quantity_accepted: "10",
          quantity_rejected: "0",
        },
        "12"
      )
    ).toEqual({
      quantity_received: "12",
      quantity_accepted: "12",
      quantity_rejected: "0",
    });
  });

  it("only updates received when accept/reject were customized", () => {
    expect(
      syncGrnAcceptRejectOnReceivedChange(
        {
          quantity_received: "10",
          quantity_accepted: "8",
          quantity_rejected: "2",
        },
        "12"
      )
    ).toEqual({ quantity_received: "12" });
  });
});

describe("defaultGrnAcceptRejectForReceived", () => {
  it("defaults all quantity to accepted", () => {
    expect(defaultGrnAcceptRejectForReceived("5")).toEqual({
      quantity_accepted: "5",
      quantity_rejected: "0",
    });
  });
});
