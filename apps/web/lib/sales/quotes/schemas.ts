import { z } from "zod";
import { salesCommerceRpcExtrasSchema } from "@/lib/sales/shared/sales-commerce-save-extras";
import { salesCommerceLineUomSchema } from "@/lib/sales/shared/sales-commerce-line-schema";

export const QUOTE_CUSTOM_FIELD_KEYS = [
  "customer_reference",
  "internal_notes",
  "terms_and_conditions",
] as const;

export type QuoteCustomFieldKey = (typeof QUOTE_CUSTOM_FIELD_KEYS)[number];

export const salesQuoteCustomFieldsSchema = z.object({
  customer_reference: z.string().trim().max(64).optional().default(""),
  internal_notes: z.string().trim().max(2000).optional().default(""),
  terms_and_conditions: z.string().trim().max(4000).optional().default(""),
});

export type SalesQuoteCustomFields = z.infer<typeof salesQuoteCustomFieldsSchema>;

export const salesQuoteLineSchema = z
  .object({
    variant_id: z.string().uuid("Select a valid variant."),
    quantity_quoted: z
      .string()
      .trim()
      .min(1, "Quantity is required.")
      .refine((value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed > 0;
      }, "Quantity must be greater than zero."),
    unit_price_selling: z
      .string()
      .trim()
      .default("0")
      .refine((value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0;
      }, "Unit price must be zero or greater."),
    discount_percentage: z
      .string()
      .trim()
      .default("0")
      .refine((value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
      }, "Discount percent must be between 0 and 100."),
    discount_amount: z
      .string()
      .trim()
      .default("0")
      .refine((value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) && parsed >= 0;
      }, "Discount amount must be zero or greater."),
  })
  .merge(salesCommerceLineUomSchema);

export const saveSalesQuotationSchema = z
  .object({
    sales_quotation_id: z.string().uuid().optional().nullable(),
    customer_id: z.string().uuid("Select a customer."),
    origin_location_id: z.string().uuid("Select an origin location.").optional().nullable(),
    billing_state: z.string().trim().min(1, "Billing state is required.").max(64),
    shipping_state: z.string().trim().min(1, "Shipping state is required.").max(64),
    valid_until: z.string().trim().min(1, "Valid until date is required."),
    custom_fields: salesQuoteCustomFieldsSchema.default({
      customer_reference: "",
      internal_notes: "",
      terms_and_conditions: "",
    }),
    lines: z.array(salesQuoteLineSchema).min(1, "Add at least one line."),
  })
  .merge(salesCommerceRpcExtrasSchema);

export type SaveSalesQuotationInput = z.infer<typeof saveSalesQuotationSchema>;

export const submitSalesQuotationForApprovalSchema = z.object({
  quotation_id: z.string().uuid("Quotation id is required."),
});

export const approveSalesQuotationSchema = z.object({
  quotation_id: z.string().uuid("Quotation id is required."),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const rejectSalesQuotationSchema = z.object({
  quotation_id: z.string().uuid("Quotation id is required."),
  notes: z.string().trim().min(1, "A rejection reason is required.").max(2000),
});

export const convertQuotationSchema = z.object({
  quotation_id: z.string().uuid("Quotation id is required."),
  origin_location_id: z.string().uuid().optional().nullable(),
});

export const confirmSalesQuotationSchema = z.object({
  quotation_id: z.string().uuid("Quotation id is required."),
});

export const sendSalesQuotationSchema = z.object({
  quotation_id: z.string().uuid("Quotation id is required."),
  sent_to_email: z.string().trim().email("Enter a valid email address.").optional().nullable(),
  send_channel: z.enum(["EMAIL", "MANUAL"]).optional().default("EMAIL"),
});
