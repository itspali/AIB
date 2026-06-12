import { z } from "zod";

export const purchaseBillLineSchema = z.object({
  variant_id: z.string().uuid(),
  purchase_order_item_id: z.string().uuid().optional().nullable(),
  quantity_billed: z.string().trim().min(1),
  unit_price_billed: z.string().trim().min(1),
});

export const savePurchaseBillSchema = z.object({
  purchase_invoice_id: z.string().uuid().optional().nullable(),
  supplier_id: z.string().uuid(),
  billing_location_id: z.string().uuid(),
  invoice_number_vendor: z.string().trim().min(1),
  purchase_order_id: z.string().uuid().optional().nullable(),
  currency_code: z.string().trim().length(3).optional().nullable(),
  exchange_rate: z.string().trim().optional().nullable(),
  bill_of_entry_number: z.string().trim().optional().nullable(),
  bill_of_entry_date: z.string().trim().optional().nullable(),
  port_code: z.string().trim().optional().nullable(),
  lines: z.array(purchaseBillLineSchema).min(1),
  goods_receipt_ids: z.array(z.string().uuid()).optional().default([]),
});
