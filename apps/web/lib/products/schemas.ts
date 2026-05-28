import { z } from "zod";
import { ITEM_CLASSIFICATIONS } from "@/lib/products/classification-labels";
import { TAX_CATEGORY_OPTIONS } from "@/lib/products/tax-options";
import { UOM_OPTIONS } from "@/lib/products/uom-options";

const decimalPattern = /^\d+(\.\d+)?$/;

function nonNegativeDecimal(maxDecimals: number, optional = false) {
  return z
    .string()
    .trim()
    .refine((value) => optional && value === "" || decimalPattern.test(value), {
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
  description: z.string().trim().max(2000),
  sku: z.string().trim().min(1, "Master SKU is required").max(64),
  barcode: z.string().trim().max(64),
  base_unit_of_measure: z.enum(UOM_OPTIONS),
  category_id: z.string().uuid().nullable(),
  is_purchasable: z.boolean(),
  is_salable: z.boolean(),
  is_active: z.boolean(),
  hsn_sac_code: z.string().trim().max(32),
  has_variants: z.boolean(),
  default_tax_category: z.enum(TAX_CATEGORY_OPTIONS),
  is_returnable: z.boolean(),
  dead_weight_kg: nonNegativeDecimal(3),
  weight: nonNegativeDecimal(4, true),
  volume: nonNegativeDecimal(4, true),
  length_cm: nonNegativeDecimal(2),
  width_cm: nonNegativeDecimal(2),
  height_cm: nonNegativeDecimal(2),
  variant_is_active: z.boolean(),
  variant_attributes: z.record(z.string(), z.string()),
  selling_price: nonNegativeDecimal(4, true),
  selling_uom: z.enum(UOM_OPTIONS),
  purchase_uom: z.enum(UOM_OPTIONS),
  purchase_uom_conversion: nonNegativeDecimal(6),
  purchase_price: nonNegativeDecimal(4, true),
  supplier_id: z.string().uuid().nullable(),
  show_advanced: z.boolean(),
}).superRefine((values, ctx) => {
  if (
    values.purchase_uom !== values.base_unit_of_measure &&
    (!values.purchase_uom_conversion || Number(values.purchase_uom_conversion) <= 0)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["purchase_uom_conversion"],
      message: "Conversion factor is required when purchase unit differs from base unit",
    });
  }

  if (values.purchase_price.trim() && !values.supplier_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["supplier_id"],
      message: "Select a preferred supplier when entering a purchase rate",
    });
  }
});

export type ProductMasterInput = z.infer<typeof productMasterSchema>;
