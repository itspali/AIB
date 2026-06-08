import { z } from "zod";
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
});

export const savePurchaseOrderSchema = z.object({
  purchase_order_id: z.string().uuid().optional().nullable(),
  destination_location_id: z.string().uuid("Select a destination location."),
  supplier_id: z.string().uuid("Select a supplier."),
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
  lines: z.array(purchaseOrderLineSchema).min(1, "Add at least one line."),
});

export type SavePurchaseOrderInput = z.infer<typeof savePurchaseOrderSchema>;

export const issuePurchaseOrderSchema = z.object({
  purchase_order_id: z.string().uuid("Purchase order id is required."),
});

export const peekPurchaseOrderNumberSchema = z.object({
  destination_location_id: z.string().uuid("Select a destination location."),
});
