import { z } from "zod";

export const bulkPricingAdjustmentModes = ["PERCENTAGE", "FIXED_OFFSET"] as const;

export type BulkPricingAdjustmentMode = (typeof bulkPricingAdjustmentModes)[number];

export const bulkPricingTargets = ["SELLING", "PURCHASE", "BOTH"] as const;

export type BulkPricingTarget = (typeof bulkPricingTargets)[number];

export const bulkPricingAdjustmentSchema = z
  .object({
    mode: z.enum(bulkPricingAdjustmentModes),
    value: z.string().trim().min(1, "Adjustment value is required."),
  })
  .superRefine((data, ctx) => {
    const parsed = Number(data.value);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid number.", path: ["value"] });
      return;
    }
    if (data.mode === "PERCENTAGE" && parsed <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Percentage must be greater than zero.",
        path: ["value"],
      });
    }
    if (data.mode === "FIXED_OFFSET" && parsed === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Fixed offset must be non-zero.",
        path: ["value"],
      });
    }
  });

export const bulkPricingSchema = z
  .object({
    target: z.enum(bulkPricingTargets),
    mode: z.enum(bulkPricingAdjustmentModes),
    value: z.string().trim().min(1, "Adjustment value is required."),
  })
  .superRefine((data, ctx) => {
    const parsed = Number(data.value);
    if (!Number.isFinite(parsed)) {
      ctx.addIssue({ code: "custom", message: "Enter a valid number.", path: ["value"] });
      return;
    }
    if (data.mode === "PERCENTAGE" && parsed <= 0) {
      ctx.addIssue({
        code: "custom",
        message: "Percentage must be greater than zero.",
        path: ["value"],
      });
    }
    if (data.mode === "FIXED_OFFSET" && parsed === 0) {
      ctx.addIssue({
        code: "custom",
        message: "Fixed offset must be non-zero.",
        path: ["value"],
      });
    }
  });

export type BulkPricingInput = z.infer<typeof bulkPricingSchema>;

export const bulkJurisdictionSchema = z.object({
  category_id: z.string().uuid("Select a category."),
  tax_rate_id: z.string().uuid("Select a tax rate registry entry."),
});

export type BulkJurisdictionInput = z.infer<typeof bulkJurisdictionSchema>;

export type BulkMutationResult = {
  success: true;
  affectedCount: number;
};

export type BulkMutationError = {
  error: string;
};

export type BulkMutationResponse = BulkMutationResult | BulkMutationError;

export function bulkSuccessToastMessage(count: number): string {
  return `Bulk Properties Applied Successfully. ${count} Product Logs Synchronized.`;
}

export const bulkCategorySchema = z.object({
  category_id: z.string().uuid("Select a category."),
});

export const bulkClassificationSchema = z.object({
  classification: z.enum([
    "PHYSICAL_GOOD",
    "RAW_MATERIAL",
    "WIP_ASSEMBLY",
    "FINISHED_GOOD",
    "KIT_BUNDLE",
    "SERVICE",
  ]),
});

export const bulkTaxCategorySchema = z.object({
  default_tax_category: z.enum(["STANDARD", "REDUCED", "ZERO_RATED", "EXEMPT"]),
});

export const bulkOperationalFlagsSchema = z
  .object({
    apply_purchasable: z.boolean(),
    is_purchasable: z.boolean().optional(),
    apply_salable: z.boolean(),
    is_salable: z.boolean().optional(),
    apply_returnable: z.boolean(),
    is_returnable: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.apply_purchasable && !data.apply_salable && !data.apply_returnable) {
      ctx.addIssue({
        code: "custom",
        message: "Select at least one flag to update.",
        path: ["apply_purchasable"],
      });
    }
  });

export const bulkTagsSchema = z.object({
  mode: z.enum(["ADD", "REMOVE"]),
  tag_ids: z.array(z.string().uuid()).min(1, "Select at least one tag."),
});

export const bulkStorefrontSchema = z.object({
  storefront_id: z.string().uuid("Select a storefront."),
  is_visible: z.boolean(),
});
