import { z } from "zod";

const decimalPattern = /^\d+(\.\d+)?$/;

function nonNegativeDecimal(maxDecimals: number, optional = false) {
  return z
    .string()
    .trim()
    .refine((value) => (optional && value === "") || decimalPattern.test(value), {
      message: "Enter a valid number",
    })
    .refine(
      (value) => {
        if (!value) return true;
        const parts = value.split(".");
        return !parts[1] || parts[1].length <= maxDecimals;
      },
      { message: `Maximum ${maxDecimals} decimal places` }
    )
    .refine((value) => !value || Number(value) >= 0, { message: "Must be zero or greater" });
}

export const itemVariantSchema = z.object({
  variant_id: z.string().uuid().nullable(),
  item_id: z.string().uuid(),
  sku: z.string().trim().min(1, "SKU is required").max(64),
  barcode: z.string().trim().max(64),
  dead_weight_kg: nonNegativeDecimal(3),
  weight: nonNegativeDecimal(4, true),
  volume: nonNegativeDecimal(4, true),
  length_cm: nonNegativeDecimal(2),
  width_cm: nonNegativeDecimal(2),
  height_cm: nonNegativeDecimal(2),
  is_active: z.boolean(),
  price: nonNegativeDecimal(4, true),
  variant_attributes: z.record(z.string(), z.string()),
});

export const itemMediaSchema = z.object({
  media_id: z.string().uuid().nullable(),
  item_id: z.string().uuid(),
  variant_id: z.string().uuid().nullable(),
  storage_url: z.string().trim().min(1, "Storage path is required"),
  sort_order: z.number().int().min(0),
  is_primary: z.boolean(),
  show_on_storefront: z.boolean(),
  show_in_digital_catalog: z.boolean(),
  show_on_internal_transactions: z.boolean(),
});

export type ItemVariantInput = z.infer<typeof itemVariantSchema>;
export type ItemMediaInput = z.infer<typeof itemMediaSchema>;
