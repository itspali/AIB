import { z } from "zod";
import { COUNTRY_OPTIONS } from "@/lib/organization/country-options";
import { CREDIT_CONTROL_OPTIONS } from "@/lib/organization/credit-control-options";
import { CURRENCY_OPTIONS } from "@/lib/organization/currency-options";
import { VALUATION_METHOD_OPTIONS } from "@/lib/organization/naming-options";

const phonePattern = /^\+?[0-9\s().-]{7,30}$/;

const namingEntrySchema = z.object({
  prefix: z.string().trim().max(32),
  digits: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d+$/.test(value), "Digits must be numeric")
    .refine((value) => {
      if (!value) return true;
      const parsed = Number(value);
      return parsed >= 3 && parsed <= 12;
    }, "Digits must be between 3 and 12"),
});

export const organizationSettingsSchema = z.object({
  legal_name: z.string().trim().min(1, "Legal entity name is required").max(200),
  trade_name: z.string().trim().max(200),
  tax_identifier: z.string().trim().max(50),
  legal_registration_number: z.string().trim().max(100),
  primary_email: z.string().trim().email("Enter a valid corporate email"),
  primary_phone: z
    .string()
    .trim()
    .min(1, "Primary phone is required")
    .max(30)
    .refine((value) => phonePattern.test(value), "Enter a valid phone number"),
  secondary_phone: z
    .string()
    .trim()
    .max(30)
    .refine((value) => value === "" || phonePattern.test(value), "Enter a valid phone number"),
  website_url: z.union([z.literal(""), z.string().trim().url("Enter a valid URL")]),
  billing_address_line1: z.string().trim().max(200),
  billing_address_line2: z.string().trim().max(200),
  billing_city: z.string().trim().max(100),
  billing_state: z.string().trim().max(100),
  billing_zip_postal: z.string().trim().max(20),
  billing_country_code: z.enum(COUNTRY_OPTIONS).or(z.literal("")),
  base_currency: z.enum(CURRENCY_OPTIONS),
  fiscal_year_start_month: z
    .string()
    .trim()
    .refine((value) => /^([1-9]|1[0-2])$/.test(value), "Select a fiscal start month"),
  logo_url: z.string().trim(),
  multi_location_enabled: z.boolean(),
  regional_hqs_enabled: z.boolean(),
  central_hq_location_id: z.string().uuid().nullable(),
  restrict_cross_warehouse_transfers: z.boolean(),
  naming_sequences: z.record(z.string(), namingEntrySchema),
  inventory_valuation_method: z.enum(VALUATION_METHOD_OPTIONS),
  allow_negative_inventory: z.boolean(),
  multi_currency_enabled: z.boolean(),
  credit_control_enforcement: z.enum(CREDIT_CONTROL_OPTIONS),
  allow_line_item_discounts: z.boolean(),
  accounting_period_closing_date: z.string().trim(),
  show_advanced: z.boolean(),
});

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;

export const grantDelegateSchema = z.object({
  user_id: z.string().uuid("Select a workspace user"),
});

export type GrantDelegateInput = z.infer<typeof grantDelegateSchema>;
