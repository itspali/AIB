import { z } from "zod";
import { UOM_FAMILIES } from "@/lib/uom/types";

const numericString = z
  .string()
  .trim()
  .refine((value) => value === "" || Number.isFinite(Number(value)), {
    message: "Must be a number",
  });

export const uomSchema = z
  .object({
    uom_id: z.string().uuid().nullable().optional(),
    code: z.string().trim().min(1, "Unit code is required"),
    name: z.string().trim().min(1, "Name is required"),
    family: z.enum(UOM_FAMILIES),
    factor_to_base: numericString,
    is_family_base: z.boolean(),
    is_active: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (value.is_family_base) return;
    const factor = Number(value.factor_to_base || "0");
    if (!Number.isFinite(factor) || factor <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["factor_to_base"],
        message: "Conversion factor must be greater than zero.",
      });
    }
  });

export type UomInput = z.infer<typeof uomSchema>;
