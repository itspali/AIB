import { z } from "zod";
import { ITEM_CLASSIFICATIONS } from "@/lib/products/classification-labels";
import { alternateUomRowSchema, customFieldRowSchema, storefrontVisibilityRowSchema } from "@/lib/products/catalog-schemas";
import {
  ITEM_COSTING_METHODS,
  ITEM_STATUSES,
  ITEM_TRACKING_MODES,
  ITEM_TYPES,
} from "@/lib/products/item-model";
import { TAX_CATEGORY_OPTIONS } from "@/lib/products/tax-options";
import {
  conversionFactorForAlternate,
  hasCatalogConversionForUnit,
} from "@/lib/products/item-uom-commerce";
import { validateItemTypeClassificationPair } from "@/lib/products/item-type-classification";
import { PRODUCT_VARIANT_STRATEGIES } from "@/lib/products/variant-strategy";

const decimalPattern = /^\d+(\.\d+)?$/;

// Units are validated against the tenant's managed UOM catalog at the UI/RPC
// layer, so the schema only enforces a non-empty code here.
const uomCode = z.string().trim().min(1, "Select a unit of measure").max(32);

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
  updated_at: z.string().nullable(),
  classification: z.enum(ITEM_CLASSIFICATIONS),
  name: z.string().trim().min(1, "Product name is required").max(200),
  description: z.string().trim().max(2000),
  sku: z.string().trim().min(1, "Product code is required").max(64),
  barcode: z.string().trim().max(64),
  base_unit_of_measure: uomCode,
  category_id: z.string().uuid().nullable(),
  variant_strategy: z.enum(PRODUCT_VARIANT_STRATEGIES),
  variant_axes: z.array(z.string().trim().min(1)),
  item_type: z.enum(ITEM_TYPES),
  track_inventory: z.boolean(),
  status: z.enum(ITEM_STATUSES),
  needs_review: z.boolean(),
  costing_method: z.enum(ITEM_COSTING_METHODS),
  standard_cost: nonNegativeDecimal(4, true),
  tracking_mode: z.enum(ITEM_TRACKING_MODES),
  is_bundle: z.boolean(),
  price_is_tax_inclusive: z.boolean(),
  is_purchasable: z.boolean(),
  is_salable: z.boolean(),
  is_active: z.boolean(),
  hsn_sac_code: z.string().trim().max(32),
  has_variants: z.boolean(),
  default_tax_category: z.enum(TAX_CATEGORY_OPTIONS),
  tax_code_id: z.string().uuid().nullable(),
  is_returnable: z.boolean(),
  dead_weight_kg: nonNegativeDecimal(3),
  volume: nonNegativeDecimal(4, true),
  length_cm: nonNegativeDecimal(2),
  width_cm: nonNegativeDecimal(2),
  height_cm: nonNegativeDecimal(2),
  variant_is_active: z.boolean(),
  variant_attributes: z.record(z.string(), z.string()),
  selling_price: nonNegativeDecimal(4, true),
  selling_uom: uomCode,
  purchase_uom: uomCode,
  purchase_uom_conversion: nonNegativeDecimal(6),
  purchase_price: nonNegativeDecimal(4, true),
  supplier_id: z.string().uuid().nullable(),
  show_advanced: z.boolean(),
  sku_mask: z.string().trim().max(128),
  custom_fields: z.array(customFieldRowSchema),
  alternate_uoms: z.array(alternateUomRowSchema),
  tag_ids: z.array(z.string().uuid()),
  storefront_visibility: z.array(storefrontVisibilityRowSchema),
}).superRefine((values, ctx) => {
  const allowLegacyPhysicalGood =
    values.classification === "PHYSICAL_GOOD" && values.item_type === "PHYSICAL";
  for (const issue of validateItemTypeClassificationPair(
    values.item_type,
    values.classification,
    values.is_bundle,
    { allowLegacyPhysicalGood }
  )) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: [issue.path],
      message: issue.message,
    });
  }

  if (values.purchase_uom !== values.base_unit_of_measure) {
    const catalogFactor = conversionFactorForAlternate(values.alternate_uoms, values.purchase_uom);
    const effectiveFactor = catalogFactor ?? values.purchase_uom_conversion;
    if (!effectiveFactor || Number(effectiveFactor) <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: catalogFactor ? ["purchase_uom"] : ["purchase_uom_conversion"],
        message: catalogFactor
          ? "Purchase unit conversion in Catalog alternates must be positive"
          : "Add this unit under Catalog alternate units with a conversion factor, or enter one here",
      });
    }
  }

  if (
    values.is_salable &&
    values.selling_uom !== values.base_unit_of_measure &&
    !hasCatalogConversionForUnit(values.alternate_uoms, values.base_unit_of_measure, values.selling_uom)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selling_uom"],
      message:
        "Add the sales unit under Catalog alternate units with a conversion factor before using it as the default sales unit",
    });
  }


  if (
    values.item_type === "PHYSICAL" &&
    values.track_inventory &&
    values.costing_method === "STANDARD" &&
    !values.standard_cost.trim()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["standard_cost"],
      message: "Standard cost is required when using the Standard costing method",
    });
  }

  const uomKeys = new Set<string>();
  for (const [index, row] of values.alternate_uoms.entries()) {
    if (row.uom_code === values.base_unit_of_measure) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alternate_uoms", index, "uom_code"],
        message: "Alternate unit must differ from base unit",
      });
    }
    if (uomKeys.has(row.uom_code)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alternate_uoms", index, "uom_code"],
        message: "Duplicate alternate unit",
      });
    }
    uomKeys.add(row.uom_code);
  }

  const customFieldKeys = new Set<string>();
  for (const [index, row] of values.custom_fields.entries()) {
    const normalized = row.key.trim().toLowerCase();
    if (normalized === "sku_mask") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["custom_fields", index, "key"],
        message: "Use the SKU mask field instead of custom_fields.sku_mask",
      });
    }
    if (customFieldKeys.has(normalized)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["custom_fields", index, "key"],
        message: "Duplicate custom field key",
      });
    }
    customFieldKeys.add(normalized);
  }
});

export type ProductMasterInput = z.infer<typeof productMasterSchema>;
