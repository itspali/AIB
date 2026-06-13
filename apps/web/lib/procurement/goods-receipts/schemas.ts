import { z } from "zod";

export const goodsReceiptLineSchema = z
  .object({
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
    quantity_accepted: z
      .string()
      .trim()
      .optional()
      .default(""),
    quantity_rejected: z
      .string()
      .trim()
      .optional()
      .default("0"),
    raw_unit_cost: z
      .string()
      .trim()
      .min(1, "Unit cost is required.")
      .refine((value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0;
      }, "Unit cost must be zero or greater."),
    is_promotional: z.boolean().optional().default(false),
  })
  .superRefine((line, ctx) => {
    const cost = Number(line.raw_unit_cost);
    if (cost <= 0 && !line.is_promotional) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unit cost must be greater than zero unless the line is promotional.",
        path: ["raw_unit_cost"],
      });
    }

    const received = Number(line.quantity_received);
    const acceptedRaw = line.quantity_accepted?.trim();
    const accepted = acceptedRaw ? Number(acceptedRaw) : received;
    const rejected = Number(line.quantity_rejected ?? "0");

    if (!Number.isFinite(accepted) || accepted < 0 || !Number.isFinite(rejected) || rejected < 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Accepted and rejected quantities must be zero or greater.",
        path: ["quantity_accepted"],
      });
      return;
    }

    if (Math.abs(accepted + rejected - received) > 0.0001) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Accepted plus rejected must equal quantity received.",
        path: ["quantity_accepted"],
      });
    }
  });

export const postGoodsReceiptSchema = z.object({
  destination_location_id: z.string().uuid("Select a destination location."),
  purchase_order_id: z.string().uuid().optional().nullable(),
  bill_of_entry_number: z.string().trim().optional().nullable(),
  bill_of_entry_date: z.string().trim().optional().nullable(),
  port_code: z.string().trim().max(10).optional().nullable(),
  exchange_rate: z.string().trim().optional().nullable(),
  assessable_value: z.string().trim().optional().nullable(),
  customs_duty_amount: z.string().trim().optional().nullable(),
  import_igst_amount: z.string().trim().optional().nullable(),
  lines: z.array(goodsReceiptLineSchema).min(1, "Add at least one line."),
  git_voucher_id: z.string().uuid().optional().nullable(),
  landed_charges: z
    .array(
      z.object({
        charge_type: z.string().trim().min(1),
        amount: z.string().trim().min(1),
        allocation_method: z.enum(["BY_QUANTITY", "BY_VALUE", "BY_WEIGHT"]).optional().nullable(),
      })
    )
    .optional()
    .default([]),
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
