import { describe, expect, it } from "vitest";
import {
  postGoodsReceiptSchema,
  validateGrnLinesAgainstOpenQty,
} from "@/lib/procurement/goods-receipts/schemas";

describe("grn schemas", () => {
  it("rejects receive quantity above open PO quantity", () => {
    const error = validateGrnLinesAgainstOpenQty(
      [
        {
          po_item_id: "c273e5ca-1d4f-6e7a-8b3c-4d5e6f7a8b9c",
          quantity_received: "12",
        },
      ],
      {
        "c273e5ca-1d4f-6e7a-8b3c-4d5e6f7a8b9c": "10",
      }
    );

    expect(error).toContain("cannot exceed");
  });

  it("accepts receive quantity within open PO quantity", () => {
    const error = validateGrnLinesAgainstOpenQty(
      [
        {
          po_item_id: "c273e5ca-1d4f-6e7a-8b3c-4d5e6f7a8b9c",
          quantity_received: "4",
        },
      ],
      {
        "c273e5ca-1d4f-6e7a-8b3c-4d5e6f7a8b9c": "10",
      }
    );

    expect(error).toBeNull();
  });

  it("requires positive unit cost on post payload", () => {
    const result = postGoodsReceiptSchema.safeParse({
      destination_location_id: "9952be31-7686-450e-a86c-f7f4253e8b5a",
      purchase_order_id: null,
      lines: [
        {
          variant_id: "b162d4b9-0c3e-5d6f-9a2b-3c4d5e6f7a8b",
          quantity_received: "2",
          raw_unit_cost: "0",
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
