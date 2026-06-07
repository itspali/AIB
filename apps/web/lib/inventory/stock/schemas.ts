import { z } from "zod";

export const stockAdjustmentKindSchema = z.enum(["OPENING", "CORRECTION", "WRITE_OFF"]);

export const stockAdjustmentLineSchema = z.object({
  variant_id: z.string().uuid("Select a valid variant."),
  quantity_delta: z
    .string()
    .trim()
    .min(1, "Quantity is required.")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed !== 0;
    }, "Quantity must be a non-zero number."),
  unit_cost: z
    .string()
    .trim()
    .default("0")
    .refine((value) => {
      if (!value) return true;
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, "Unit cost must be zero or greater."),
  line_notes: z.string().trim().optional(),
});

export const postStockAdjustmentSchema = z.object({
  location_id: z.string().uuid("Select a location."),
  kind: stockAdjustmentKindSchema,
  reason: z.string().trim().min(1, "Reason is required."),
  notes: z.string().trim().optional(),
  lines: z.array(stockAdjustmentLineSchema).min(1, "Add at least one line."),
});

export type PostStockAdjustmentInput = z.infer<typeof postStockAdjustmentSchema>;
