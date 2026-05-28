import { z } from "zod";
import { COUNTRY_OPTIONS } from "@/lib/organization/country-options";
import { ENTERPRISE_LOCATION_TYPES, LEGACY_LOCATION_TYPES } from "@/lib/locations/types";
import { DOM_FULFILLMENT_STRATEGIES } from "@/lib/locations/dom-routing";

const allLocationTypes = [...ENTERPRISE_LOCATION_TYPES, ...LEGACY_LOCATION_TYPES] as const;
const locationTypeSchema = z.enum(allLocationTypes);

export const locationFormSchema = z.object({
  location_id: z.string().uuid().nullable(),
  name: z.string().trim().min(1, "Location name is required").max(200),
  code: z.string().trim().min(1, "Location code is required").max(30),
  location_type: locationTypeSchema,
  parent_location_id: z.string().uuid().nullable(),
  address_line1: z.string().trim().min(1, "Address is required").max(200),
  address_line2: z.string().trim().max(200),
  city: z.string().trim().min(1, "City is required").max(100),
  state: z.string().trim().min(1, "State is required").max(100),
  zip_postal: z.string().trim().min(1, "Postal code is required").max(20),
  country_code: z.enum(COUNTRY_OPTIONS),
  manager_name: z.string().trim().max(200),
  contact_email: z.union([z.literal(""), z.string().trim().email("Enter a valid email")]),
  contact_phone: z.string().trim().max(30),
  is_stock_holding: z.boolean(),
  location_tax_identifier: z.string().trim().max(50),
  tax_registered_name: z.string().trim().max(200),
  show_advanced: z.boolean(),
});

export type LocationFormInput = z.infer<typeof locationFormSchema>;

export const domRoutingSchema = z.object({
  primary_fulfillment_strategy: z.enum(DOM_FULFILLMENT_STRATEGIES),
  central_fallback_location_id: z.string().uuid().nullable(),
  local_branch_safety_threshold: z
    .number()
    .int("Safety threshold must be a whole number")
    .min(0, "Safety threshold cannot be negative"),
});

export type DomRoutingInput = z.infer<typeof domRoutingSchema>;

export const domRoutingSaveSchema = z.object({
  dom_routing: domRoutingSchema,
});

export type DomRoutingSaveInput = z.infer<typeof domRoutingSaveSchema>;
