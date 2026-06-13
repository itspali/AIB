import { z } from "zod";
import { TAX_CODE_KINDS, TAX_RULE_BASES } from "@/lib/tax/types";

const numericString = z
  .string()
  .trim()
  .refine((value) => value === "" || Number.isFinite(Number(value)), {
    message: "Must be a number",
  });

const componentSchema = z.object({
  name: z.string().trim(),
  rate: numericString,
  sort_order: z.number().int().nonnegative(),
});

const ruleSchema = z.object({
  basis: z.enum(TAX_RULE_BASES),
  threshold_min: numericString,
  threshold_max: numericString,
  rate: numericString,
});

export const taxCodeSchema = z
  .object({
    tax_code_id: z.string().uuid().nullable().optional(),
    code: z.string().trim().min(1, "Tax code is required"),
    name: z.string().trim().min(1, "Name is required"),
    kind: z.enum(TAX_CODE_KINDS),
    rate: numericString,
    is_inclusive_default: z.boolean(),
    is_variable: z.boolean(),
    effective_from: z.string().nullable(),
    effective_to: z.string().nullable(),
    is_active: z.boolean(),
    is_recoverable: z.boolean(),
    components: z.array(componentSchema),
    rules: z.array(ruleSchema),
  })
  .superRefine((value, ctx) => {
    if (!value.is_variable) return;

    const rules = [...value.rules]
      .map((rule) => ({
        min: Number(rule.threshold_min || "0"),
        max: rule.threshold_max.trim() === "" ? null : Number(rule.threshold_max),
      }))
      .sort((a, b) => a.min - b.min);

    if (rules.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rules"],
        message: "A variable tax code needs at least one slab rule.",
      });
      return;
    }

    let expectedMin = 0;
    for (let index = 0; index < rules.length; index += 1) {
      const rule = rules[index];
      if (rule.min !== expectedMin) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules"],
          message: "Slab rules must be contiguous and start at 0 (no gaps or overlaps).",
        });
        return;
      }
      if (rule.max !== null && rule.max <= rule.min) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["rules"],
          message: "Each slab's upper bound must be greater than its lower bound.",
        });
        return;
      }
      expectedMin = rule.max ?? Number.POSITIVE_INFINITY;
    }
  });

export type TaxCodeInput = z.infer<typeof taxCodeSchema>;
