import { z } from "zod";
import { UOM_OPTIONS } from "@/lib/products/uom-options";

export const alternateUomRowSchema = z.object({
  uom_code: z.enum(UOM_OPTIONS),
  conversion_factor: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Enter a valid conversion factor")
    .refine((value) => Number(value) > 0, "Conversion factor must be positive"),
});

export const customFieldRowSchema = z.object({
  key: z.string().trim().min(1, "Field key is required").max(64),
  value: z.string().trim().max(500),
});

export const storefrontVisibilityRowSchema = z.object({
  storefront_id: z.string().uuid(),
  is_visible: z.boolean(),
  store_custom_name: z.string().trim().max(200),
  store_price_book_id: z.string().uuid().nullable(),
});

export type AlternateUomRow = z.infer<typeof alternateUomRowSchema>;
export type CustomFieldRow = z.infer<typeof customFieldRowSchema>;
export type StorefrontVisibilityRow = z.infer<typeof storefrontVisibilityRowSchema>;
