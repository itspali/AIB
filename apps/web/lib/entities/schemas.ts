import { z } from "zod";
import {
  ENTITY_COMMERCIAL_TYPES,
  TAX_TREATMENT_TYPES,
  taxRegistrationRequired,
} from "@/lib/entities/types";

const phonePattern = /^\+?[0-9\s().-]{7,30}$/;

const optionalPhone = z
  .string()
  .trim()
  .max(30)
  .refine((value) => value === "" || phonePattern.test(value), "Enter a valid phone number");

const optionalEmail = z.union([
  z.literal(""),
  z.string().trim().email("Enter a valid email").max(200),
]);

export const entityContactSchema = z.object({
  contact_id: z.string().uuid().nullable(),
  first_name: z.string().trim().min(1, "First name is required").max(100),
  last_name: z.string().trim().max(100),
  email: optionalEmail,
  phone: optionalPhone,
  mobile: optionalPhone,
  whatsapp_number: optionalPhone,
  department: z.string().trim().max(100),
  job_title: z.string().trim().max(100),
  use_mobile_for_whatsapp: z.boolean(),
  is_primary: z.boolean(),
  is_active: z.boolean(),
});

export const entityContactsSchema = z.array(entityContactSchema);

export const entityMasterSchema = z
  .object({
    entity_id: z.string().uuid().nullable(),
    name: z.string().trim().min(1, "Name is required").max(200),
    type: z.enum(ENTITY_COMMERCIAL_TYPES),
    tax_treatment: z.enum(TAX_TREATMENT_TYPES),
    tax_registration_number: z.string().trim().max(50),
    legal_name: z.string().trim().max(200),
    code: z.string().trim().max(30),
    credit_limit: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d+(\.\d+)?$/.test(value), {
        message: "Enter a valid number",
      })
      .refine((value) => value === "" || Number(value) >= 0, {
        message: "Must be zero or greater",
      }),
    payment_terms_days: z
      .string()
      .trim()
      .refine((value) => value === "" || /^\d+$/.test(value), {
        message: "Enter a whole number of days",
      })
      .refine((value) => value === "" || Number(value) >= 0, {
        message: "Must be zero or greater",
      }),
    base_currency_override: z
      .string()
      .trim()
      .max(3)
      .refine(
        (value) => value === "" || /^[A-Z]{3}$/.test(value),
        "Enter a 3-letter currency code"
      ),
    billing_address_line1: z.string().trim().max(200),
    billing_address_line2: z.string().trim().max(200),
    billing_city: z.string().trim().max(100),
    billing_state: z.string().trim().max(100),
    billing_zip_postal: z.string().trim().max(20),
    billing_country_code: z
      .string()
      .trim()
      .max(2)
      .refine((value) => value === "" || /^[A-Z]{2}$/.test(value), "Enter a country code"),
    shipping_address_line1: z.string().trim().max(200),
    shipping_address_line2: z.string().trim().max(200),
    shipping_city: z.string().trim().max(100),
    shipping_state: z.string().trim().max(100),
    shipping_zip_postal: z.string().trim().max(20),
    shipping_country_code: z
      .string()
      .trim()
      .max(2)
      .refine((value) => value === "" || /^[A-Z]{2}$/.test(value), "Enter a country code"),
    same_as_billing: z.boolean(),
    incoterms_code: z
      .string()
      .trim()
      .max(3)
      .refine((value) => value === "" || value.length === 3, "Enter a 3-letter incoterms code"),
    default_shipping_method: z.string().trim().max(100),
    company_email: optionalEmail,
    company_phone: optionalPhone,
    website_url: z.union([z.literal(""), z.string().trim().url("Enter a valid URL").max(500)]),
    internal_notes: z.string().trim().max(4000),
    custom_fields: z.record(z.string(), z.string()),
    is_active: z.boolean(),
    primary_contact: entityContactSchema,
    extended_contacts: entityContactsSchema,
  })
  .superRefine((values, ctx) => {
    if (
      taxRegistrationRequired(values.tax_treatment) &&
      !values.tax_registration_number.trim()
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["tax_registration_number"],
        message: "Tax registration number is required for this tax treatment",
      });
    }
  });

export type EntityMasterSchemaValues = z.infer<typeof entityMasterSchema>;
export type EntityContactSchemaValues = z.infer<typeof entityContactSchema>;
