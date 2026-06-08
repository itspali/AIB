import { z } from "zod";

export const groupSettingsSchema = z.object({
  name: z.string().trim().min(1, "Group name is required"),
  legal_name: z.string().trim().optional().default(""),
  trade_name: z.string().trim().optional().default(""),
  primary_email: z.string().trim().email("Valid email required"),
  primary_phone: z.string().trim().min(1, "Phone is required"),
});

export const createGroupOrganizationSchema = z.object({
  company_name: z.string().trim().min(1, "Organization name is required"),
  primary_email: z.string().trim().email("Valid email required"),
  primary_phone: z.string().trim().optional().default(""),
});

export const createTenantGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required"),
  primary_email: z.string().trim().email("Valid email required"),
  primary_phone: z.string().trim().optional().default(""),
});

export const inviteOrganizationToGroupSchema = z.object({
  group_id: z.string().uuid("Invalid group"),
  identifier: z
    .string()
    .trim()
    .min(1, "Primary email or workspace code is required")
    .refine(
      (value) =>
        value.includes("@") || /^ORG-[A-Z0-9]{6}$/i.test(value),
      "Use the organization's primary email or workspace code (e.g. ORG-AB12CD)"
    ),
  message: z.string().trim().optional().default(""),
});

export const suspendGroupOrganizationSchema = z.object({
  tenant_id: z.string().uuid("Invalid organization"),
  reason: z.string().trim().optional().default(""),
});
