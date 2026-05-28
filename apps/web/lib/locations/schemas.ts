import { z } from "zod";
import { COUNTRY_OPTIONS } from "@/lib/organization/country-options";
import { PRESENCE_ENVIRONMENTS } from "@/lib/locations/types";
import { DOM_FULFILLMENT_STRATEGIES } from "@/lib/locations/dom-routing";

export const locationFormSchema = z
  .object({
    location_id: z.string().uuid().nullable(),
    name: z.string().trim().min(1, "Location name is required").max(200),
    code: z.string().trim().min(1, "Location code is required").max(30),
    presence_type: z.enum(PRESENCE_ENVIRONMENTS),
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
    is_administrative_office: z.boolean(),
    is_commercial_storefront: z.boolean(),
    is_stock_holding: z.boolean(),
    pos_terminal_count: z.number().int().min(0, "POS terminal count cannot be negative"),
    location_tax_identifier: z.string().trim().max(50),
    tax_registered_name: z.string().trim().max(200),
    show_advanced: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.presence_type === "VIRTUAL" && values.is_stock_holding) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Virtual locations cannot be stock-holding",
        path: ["is_stock_holding"],
      });
    }
    if (!values.is_commercial_storefront && values.pos_terminal_count > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "POS terminals require a commercial storefront location",
        path: ["pos_terminal_count"],
      });
    }
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
