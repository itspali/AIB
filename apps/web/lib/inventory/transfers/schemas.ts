import { z } from "zod";
import { validateReceiptLines } from "@/lib/inventory/transfers/receipt-validation";

const optionalCostField = z
  .string()
  .trim()
  .optional()
  .refine((value) => {
    if (!value) return true;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }, "Cost must be zero or greater.");

export const transferDraftLineSchema = z.object({
  variant_id: z.string().uuid("Select a valid variant."),
  quantity_dispatched: z
    .string()
    .trim()
    .min(1, "Quantity is required.")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0;
    }, "Quantity must be greater than zero."),
});

export const saveStockTransferSchema = z
  .object({
    transfer_id: z.string().uuid().optional().nullable(),
    source_location_id: z.string().uuid("Select a source location."),
    destination_location_id: z.string().uuid("Select a destination location."),
    lines: z.array(transferDraftLineSchema).min(1, "Add at least one line."),
    inter_company_freight_cost: optionalCostField,
    loading_overhead_cost: optionalCostField,
    unloading_overhead_cost: optionalCostField,
  })
  .refine((values) => values.source_location_id !== values.destination_location_id, {
    message: "Source and destination must be different locations.",
    path: ["destination_location_id"],
  });

export const receiveTransferLineSchema = z.object({
  line_id: z.string().uuid(),
  quantity_accepted: z
    .string()
    .trim()
    .default("0")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, "Accepted quantity must be zero or greater."),
  quantity_damaged: z
    .string()
    .trim()
    .default("0")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, "Damaged quantity must be zero or greater."),
  quantity_lost: z
    .string()
    .trim()
    .default("0")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, "Lost quantity must be zero or greater."),
});

export const receiveStockTransferSchema = z
  .object({
    transfer_id: z.string().uuid(),
    lines: z.array(receiveTransferLineSchema).min(1),
    dispatched_by_line_id: z.record(z.string(), z.string()).optional(),
  })
  .superRefine((values, ctx) => {
    const receiptLines = values.lines.map((line) => ({
      line_id: line.line_id,
      quantity_dispatched: values.dispatched_by_line_id?.[line.line_id] ?? "0",
      quantity_accepted: line.quantity_accepted,
      quantity_damaged: line.quantity_damaged,
      quantity_lost: line.quantity_lost,
    }));

    const message = validateReceiptLines(receiptLines);
    if (message) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message,
        path: ["lines"],
      });
    }
  });

export type SaveStockTransferInput = z.infer<typeof saveStockTransferSchema>;
export type ReceiveStockTransferInput = z.infer<typeof receiveStockTransferSchema>;
