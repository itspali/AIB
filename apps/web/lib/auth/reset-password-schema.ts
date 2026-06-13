import { z } from "zod";

export const resetPasswordSchema = z
  .object({
    new_password: z.string(),
    confirm_password: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.new_password.length < 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "New password must be at least 12 characters",
        path: ["new_password"],
      });
    } else if (
      !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(values.new_password)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Include upper, lower, number, and special character",
        path: ["new_password"],
      });
    }

    if (values.new_password !== values.confirm_password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match",
        path: ["confirm_password"],
      });
    }
  });

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
