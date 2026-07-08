import { z } from "zod";
import { COUNTRY_OPTIONS } from "@/lib/organization/country-options";
import { CREDIT_CONTROL_OPTIONS } from "@/lib/organization/credit-control-options";
import { CURRENCY_OPTIONS } from "@/lib/organization/currency-options";
import { VALUATION_METHOD_OPTIONS } from "@/lib/organization/naming-options";
import { SCAN_IDENTIFIER_POLICIES } from "@/lib/products/catalog-item-settings";
import { isValidTimezone } from "@/lib/settings/timezone-options";
import { THEMES, type Theme } from "@/lib/theme/themes";

const phonePattern = /^\+?[0-9\s().-]{7,30}$/;

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
  country_code: z.enum(COUNTRY_OPTIONS).or(z.literal("")),
  timezone: z
    .string()
    .trim()
    .min(1, "Select a workspace timezone")
    .refine((value) => isValidTimezone(value), "Select a valid timezone"),
  locale: z.string().trim().min(2, "Select a locale").max(10),
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
  inventory_valuation_method: z.enum(VALUATION_METHOD_OPTIONS),
  allow_negative_inventory: z.boolean(),
  multi_currency_enabled: z.boolean(),
  credit_control_enforcement: z.enum(CREDIT_CONTROL_OPTIONS),
  scan_identifier_policy: z.enum(SCAN_IDENTIFIER_POLICIES),
  sku_auto_generation_enabled: z.boolean(),
  sku_auto_pattern: z.string().trim().min(1).max(64),
  sku_auto_prefix: z.string().trim().min(1).max(24),
  allow_duplicate_item_names: z.boolean(),
  allow_line_item_discounts: z.boolean(),
  allow_transaction_discounts: z.boolean(),
  accounting_period_closing_date: z.string().trim(),
  search_financial_fields_mode: z.enum(["role_default", "enabled", "disabled"]),
  default_theme: z.enum(THEMES as [Theme, ...Theme[]]),
  primary_hue: z.number().int().min(0).max(360).nullable(),
  accent_hue: z.number().int().min(0).max(360).nullable(),
  allow_location_theme_override: z.boolean(),
  allow_user_theme_override: z.boolean(),
  show_advanced: z.boolean(),
});

export type OrganizationSettingsInput = z.infer<typeof organizationSettingsSchema>;

export const grantDelegateSchema = z.object({
  user_id: z.string().uuid("Select a workspace user"),
});

export type GrantDelegateInput = z.infer<typeof grantDelegateSchema>;

export const grantPoApprovalDelegateSchema = z.object({
  delegator_user_id: z.string().uuid("Select an approver"),
  delegate_user_id: z.string().uuid("Select a delegate user"),
  valid_until: z.string().datetime().nullable().optional(),
});

export type GrantPoApprovalDelegateInput = z.infer<typeof grantPoApprovalDelegateSchema>;
