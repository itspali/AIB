import { z } from "zod";

export const goodsReceiptLineSchema = z.object({
  variant_id: z.string().uuid("Select a valid variant."),
  po_item_id: z.string().uuid().optional().nullable(),
  quantity_received: z
    .string()
    .trim()
    .min(1, "Quantity is required.")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0;
    }, "Quantity must be greater than zero."),
  raw_unit_cost: z
    .string()
    .trim()
    .min(1, "Unit cost is required.")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0;
    }, "Unit cost must be greater than zero."),
});

export const postGoodsReceiptSchema = z.object({
  destination_location_id: z.string().uuid("Select a destination location."),
  purchase_order_id: z.string().uuid().optional().nullable(),
  lines: z.array(goodsReceiptLineSchema).min(1, "Add at least one line."),
});

export type PostGoodsReceiptInput = z.infer<typeof postGoodsReceiptSchema>;

export type GrnLineOpenQtyContext = {
  po_item_id: string;
  open_quantity: string;
};

export function validateGrnLinesAgainstOpenQty(
  lines: Array<{ po_item_id?: string | null; quantity_received: string }>,
  openByPoItemId: Record<string, string>
): string | null {
  for (const line of lines) {
    if (!line.po_item_id) continue;
    const openQty = openByPoItemId[line.po_item_id];
    if (openQty == null) continue;
    const received = Number(line.quantity_received);
    const open = Number(openQty);
    if (!Number.isFinite(received) || !Number.isFinite(open)) {
      return "Enter valid quantities for each line.";
    }
    if (received > open) {
      return "Receive quantity cannot exceed the open purchase order quantity.";
    }
  }
  return null;
}
