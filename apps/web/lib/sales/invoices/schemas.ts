import { z } from "zod";
import { salesCommerceRpcExtrasSchema } from "@/lib/sales/shared/sales-commerce-save-extras";
import { salesCommerceLineUomSchema } from "@/lib/sales/shared/sales-commerce-line-schema";

export const INVOICE_CUSTOM_FIELD_KEYS = [
  "customer_po_number",
  "internal_notes",
] as const;

export const salesInvoiceCustomFieldsSchema = z.object({
  customer_po_number: z.string().trim().max(64).optional().default(""),
  internal_notes: z.string().trim().max(2000).optional().default(""),
});

export type SalesInvoiceCustomFields = z.infer<typeof salesInvoiceCustomFieldsSchema>;

export const salesInvoiceLineSchema = z
  .object({
    variant_id: z.string().uuid("Select a valid variant."),
    quantity_invoiced: z
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
    source_order_line_id: z.string().uuid().optional().nullable(),
    source_quotation_line_id: z.string().uuid().optional().nullable(),
  })
  .merge(salesCommerceLineUomSchema);

export const saveSalesInvoiceSchema = z
  .object({
    sales_invoice_id: z.string().uuid().optional().nullable(),
    customer_id: z.string().uuid("Select a customer."),
    origin_location_id: z.string().uuid("Select an origin location."),
    billing_state: z.string().trim().min(1, "Billing state is required.").max(64),
    shipping_state: z.string().trim().min(1, "Shipping state is required.").max(64),
    source_order_id: z.string().uuid().optional().nullable(),
    source_quotation_id: z.string().uuid().optional().nullable(),
    custom_fields: salesInvoiceCustomFieldsSchema.default({
      customer_po_number: "",
      internal_notes: "",
    }),
    lines: z.array(salesInvoiceLineSchema).min(1, "Add at least one line."),
  })
  .merge(salesCommerceRpcExtrasSchema);

export type SaveSalesInvoiceInput = z.infer<typeof saveSalesInvoiceSchema>;

export const submitSalesInvoiceForApprovalSchema = z.object({
  sales_invoice_id: z.string().uuid("Invoice id is required."),
});

export const approveSalesInvoiceSchema = z.object({
  sales_invoice_id: z.string().uuid("Invoice id is required."),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const rejectSalesInvoiceSchema = z.object({
  sales_invoice_id: z.string().uuid("Invoice id is required."),
  notes: z.string().trim().min(1, "A rejection reason is required.").max(2000),
});

export const postSalesInvoiceSchema = z.object({
  sales_invoice_id: z.string().uuid("Invoice id is required."),
});

export const convertOrderToInvoiceSchema = z.object({
  sales_order_id: z.string().uuid("Sales order id is required."),
  origin_location_id: z.string().uuid("Select an origin location."),
});
