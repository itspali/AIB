import { z } from "zod";
import { salesCommerceRpcExtrasSchema } from "@/lib/sales/shared/sales-commerce-save-extras";
import { salesCommerceLineUomSchema } from "@/lib/sales/shared/sales-commerce-line-schema";

export const SO_CUSTOM_FIELD_KEYS = [
  "customer_po_number",
  "requested_ship_date",
  "internal_notes",
] as const;

export type SoCustomFieldKey = (typeof SO_CUSTOM_FIELD_KEYS)[number];

export const salesOrderCustomFieldsSchema = z.object({
  customer_po_number: z.string().trim().max(64).optional().default(""),
  requested_ship_date: z.string().trim().max(32).optional().default(""),
  internal_notes: z.string().trim().max(2000).optional().default(""),
});

export type SalesOrderCustomFields = z.infer<typeof salesOrderCustomFieldsSchema>;

export const salesOrderLineSchema = z
  .object({
    variant_id: z.string().uuid("Select a valid variant."),
    quantity_ordered: z
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
    source_quotation_line_id: z.string().uuid().optional().nullable(),
  })
  .merge(salesCommerceLineUomSchema);

export const saveSalesOrderSchema = z
  .object({
    sales_order_id: z.string().uuid().optional().nullable(),
    customer_id: z.string().uuid("Select a customer."),
    shipping_location_id: z.string().uuid("Select a shipping location."),
    billing_state: z.string().trim().min(1, "Billing state is required.").max(64),
    shipping_state: z.string().trim().min(1, "Shipping state is required.").max(64),
    source_quotation_id: z.string().uuid().optional().nullable(),
    custom_fields: salesOrderCustomFieldsSchema.default({
      customer_po_number: "",
      requested_ship_date: "",
      internal_notes: "",
    }),
    lines: z.array(salesOrderLineSchema).min(1, "Add at least one line."),
  })
  .merge(salesCommerceRpcExtrasSchema);

export type SaveSalesOrderInput = z.infer<typeof saveSalesOrderSchema>;

export const submitSalesOrderForApprovalSchema = z.object({
  sales_order_id: z.string().uuid("Sales order id is required."),
});

export const approveSalesOrderSchema = z.object({
  sales_order_id: z.string().uuid("Sales order id is required."),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const rejectSalesOrderSchema = z.object({
  sales_order_id: z.string().uuid("Sales order id is required."),
  notes: z.string().trim().min(1, "A rejection reason is required.").max(2000),
});

export const confirmSalesOrderSchema = z.object({
  sales_order_id: z.string().uuid("Sales order id is required."),
});

export const peekSalesOrderNumberSchema = z.object({
  shipping_location_id: z.string().uuid("Select a shipping location."),
});

export const updateSalesOrderVoucherNumberSchema = z.object({
  sales_order_id: z.string().uuid("Sales order id is required."),
  voucher_number: z
    .string()
    .trim()
    .min(1, "SO number is required.")
    .max(64, "SO number must be 64 characters or fewer."),
});
