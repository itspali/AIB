import { z } from "zod";
import { isValidTimezone } from "@/lib/settings/timezone-options";

const E164_REGEX = /^\+[1-9]\d{1,14}$/;

export const uiDensitySchema = z.enum(["DENSE", "STANDARD"]);

export const profileSettingsSchema = z
  .object({
    first_name: z.string().trim().min(1, "First name is required"),
    last_name: z.string().trim().min(1, "Last name is required"),
    phone_number: z
      .string()
      .trim()
      .max(30, "Phone number must be 30 characters or fewer")
      .refine((value) => value === "" || E164_REGEX.test(value), {
        message: "Use E.164 format (e.g. +12125550123)",
      }),
    avatar_url: z.string().trim(),
    timezone: z
      .string()
      .trim()
      .min(1, "Timezone is required")
      .refine(isValidTimezone, { message: "Select a valid IANA timezone" }),
    ui_density: uiDensitySchema,
    current_password: z.string(),
    new_password: z.string(),
    confirm_password: z.string(),
  })
  .superRefine((values, ctx) => {
    const wantsPasswordChange =
      values.current_password.trim() ||
      values.new_password.trim() ||
      values.confirm_password.trim();

    if (!wantsPasswordChange) return;

    if (!values.current_password.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Current password is required",
        path: ["current_password"],
      });
    }

    if (values.new_password.length < 12) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "New password must be at least 12 characters",
        path: ["new_password"],
      });
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).+$/.test(values.new_password)) {
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

export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;
