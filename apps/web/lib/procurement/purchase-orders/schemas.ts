import { z } from "zod";
import { CURRENCY_OPTIONS } from "@/lib/organization/currency-options";
import { purchaseOrderCustomFieldsSchema } from "@/lib/procurement/purchase-orders/custom-fields";

export const purchaseOrderLineSchema = z.object({
  variant_id: z.string().uuid("Select a valid variant."),
  quantity_ordered: z
    .string()
    .trim()
    .min(1, "Quantity is required.")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed > 0;
    }, "Quantity must be greater than zero."),
  unit_price_contractual: z
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
  uom_code: z.string().trim().min(1).max(32).optional(),
  is_promotional: z.boolean().optional(),
  linked_parent_line_id: z.string().uuid().optional().nullable(),
  promo_group_id: z.string().uuid().optional().nullable(),
  promotional_category: z.string().trim().max(64).optional().nullable(),
});

export const savePurchaseOrderSchema = z.object({
  purchase_order_id: z.string().uuid().optional().nullable(),
  destination_location_id: z.string().uuid("Select a destination location."),
  supplier_id: z.string().uuid("Select a supplier."),
  currency_code: z.enum(CURRENCY_OPTIONS, { message: "Select a currency." }),
  payment_terms_days: z
    .string()
    .trim()
    .default("0")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, "Payment terms must be zero or greater."),
  custom_fields: purchaseOrderCustomFieldsSchema.default({
    requisition_number: "",
    expected_delivery_date: "",
    internal_notes: "",
  }),
  prices_tax_inclusive: z.boolean().default(false),
  shipping_amount: z
    .string()
    .trim()
    .default("0")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, "Shipping amount must be zero or greater."),
  shipping_tax_rate_pct: z
    .string()
    .trim()
    .default("0")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
    }, "Shipping tax rate must be between 0 and 100."),
  shipping_tax_amount: z
    .string()
    .trim()
    .default("0")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, "Shipping tax amount must be zero or greater."),
  shipping_tax_type: z.enum(["percent", "amount"]).default("percent"),
  round_off_amount: z
    .string()
    .trim()
    .default("0")
    .refine((value) => Number.isFinite(Number(value)), "Round off must be a valid number."),
  additional_charges_amount: z
    .string()
    .trim()
    .default("0")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, "Additional charges must be zero or greater."),
  transaction_discount_percentage: z
    .string()
    .trim()
    .default("0")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
    }, "Trade discount percent must be between 0 and 100."),
  transaction_discount_amount: z
    .string()
    .trim()
    .default("0")
    .refine((value) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) && parsed >= 0;
    }, "Trade discount amount must be zero or greater."),
  transaction_discount_type: z.enum(["percent", "amount"]).default("percent"),
  lines: z.array(purchaseOrderLineSchema).min(1, "Add at least one line."),
});

export type SavePurchaseOrderInput = z.infer<typeof savePurchaseOrderSchema>;

export const issuePurchaseOrderSchema = z.object({
  purchase_order_id: z.string().uuid("Purchase order id is required."),
});

export const peekPurchaseOrderNumberSchema = z.object({
  destination_location_id: z.string().uuid("Select a destination location."),
});

export const updatePurchaseOrderVoucherNumberSchema = z.object({
  purchase_order_id: z.string().uuid("Purchase order id is required."),
  voucher_number: z
    .string()
    .trim()
    .min(1, "PO number is required.")
    .max(64, "PO number must be 64 characters or fewer."),
});

export const supplierItemInsightsSchema = z.object({
  supplier_id: z.string().uuid("Select a supplier."),
  variant_id: z.string().uuid("Select a variant."),
  destination_location_id: z.string().uuid("Select a destination location."),
  line_unit_price: z.string().trim().optional(),
  exclude_purchase_order_id: z.string().uuid().optional().nullable(),
});
