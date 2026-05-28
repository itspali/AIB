import { z } from "zod";
import { ITEM_CLASSIFICATIONS } from "@/lib/products/classification-labels";
import { UOM_OPTIONS } from "@/lib/products/uom-options";

const decimalPattern = /^\d+(\.\d+)?$/;

function nonNegativeDecimal(maxDecimals: number) {
  return z
    .string()
    .trim()
    .refine((value) => value === "" || decimalPattern.test(value), {
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

export const productMasterSchema = z.object({
  item_id: z.string().uuid().nullable(),
  classification: z.enum(ITEM_CLASSIFICATIONS),
  name: z.string().trim().min(1, "Product name is required").max(200),
  sku: z.string().trim().min(1, "Master SKU is required").max(64),
  base_unit_of_measure: z.enum(UOM_OPTIONS),
  category_id: z.string().uuid().nullable(),
  hsn_sac_code: z.string().trim().max(32),
  is_returnable: z.boolean(),
  dead_weight_kg: nonNegativeDecimal(3),
  length_cm: nonNegativeDecimal(2),
  width_cm: nonNegativeDecimal(2),
  height_cm: nonNegativeDecimal(2),
  show_advanced: z.boolean(),
});

export type ProductMasterInput = z.infer<typeof productMasterSchema>;
