import { describe, expect, it } from "vitest";
import {
  savePurchaseOrderSchema,
  updatePurchaseOrderVoucherNumberSchema,
} from "@/lib/procurement/purchase-orders/schemas";

describe("purchase-order schemas", () => {
  it("requires at least one line with positive quantity", () => {
    const result = savePurchaseOrderSchema.safeParse({
      destination_location_id: "9952be31-7686-450e-a86c-f7f4253e8b5a",
      supplier_id: "a052c3a8-9b2d-4c5e-8f1a-2b3c4d5e6f7a",
      lines: [
        {
          variant_id: "b162d4b9-0c3e-5d6f-9a2b-3c4d5e6f7a8b",
          quantity_ordered: "0",
          unit_price_contractual: "10",
        },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("accepts a valid draft payload", () => {
    const result = savePurchaseOrderSchema.safeParse({
      destination_location_id: "9952be31-7686-450e-a86c-f7f4253e8b5a",
      supplier_id: "a052c3a8-9b2d-4c5e-8f1a-2b3c4d5e6f7a",
      currency_code: "USD",
      payment_terms_days: "30",
      custom_fields: {
        requisition_number: "REQ-1",
        expected_delivery_date: "",
        internal_notes: "",
      },
      lines: [
        {
          variant_id: "b162d4b9-0c3e-5d6f-9a2b-3c4d5e6f7a8b",
          quantity_ordered: "5",
          unit_price_contractual: "12.5",
        },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("requires a non-empty PO number override", () => {
    const result = updatePurchaseOrderVoucherNumberSchema.safeParse({
      purchase_order_id: "9952be31-7686-450e-a86c-f7f4253e8b5a",
      voucher_number: "   ",
    });

    expect(result.success).toBe(false);
  });
});
