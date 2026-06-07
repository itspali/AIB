import { z } from "zod";

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
    inter_company_freight_cost: z.string().trim().optional(),
    loading_overhead_cost: z.string().trim().optional(),
    unloading_overhead_cost: z.string().trim().optional(),
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

export const receiveStockTransferSchema = z.object({
  transfer_id: z.string().uuid(),
  lines: z.array(receiveTransferLineSchema).min(1),
});

export type SaveStockTransferInput = z.infer<typeof saveStockTransferSchema>;
export type ReceiveStockTransferInput = z.infer<typeof receiveStockTransferSchema>;
