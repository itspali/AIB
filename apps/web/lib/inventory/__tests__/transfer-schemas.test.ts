import { describe, expect, it } from "vitest";
import {
  receiveStockTransferSchema,
  saveStockTransferSchema,
} from "@/lib/inventory/transfers/schemas";

describe("saveStockTransferSchema", () => {
  it("rejects identical source and destination", () => {
    const locationId = "11111111-1111-1111-1111-111111111111";
    const variantId = "22222222-2222-2222-2222-222222222222";

    const result = saveStockTransferSchema.safeParse({
      source_location_id: locationId,
      destination_location_id: locationId,
      lines: [{ variant_id: variantId, quantity_dispatched: "5" }],
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid draft payload", () => {
    const result = saveStockTransferSchema.safeParse({
      source_location_id: "11111111-1111-1111-1111-111111111111",
      destination_location_id: "22222222-2222-2222-2222-222222222222",
      lines: [
        {
          variant_id: "33333333-3333-3333-3333-333333333333",
          quantity_dispatched: "2.5",
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});

describe("receiveStockTransferSchema", () => {
  it("requires receipt lines", () => {
    const result = receiveStockTransferSchema.safeParse({
      transfer_id: "11111111-1111-1111-1111-111111111111",
      lines: [],
    });

    expect(result.success).toBe(false);
  });
});
