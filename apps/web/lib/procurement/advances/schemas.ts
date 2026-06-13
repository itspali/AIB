import { z } from "zod";

export const saveVendorAdvanceSchema = z.object({
  advance_id: z.string().uuid().optional().nullable(),
  supplier_id: z.string().uuid(),
  payment_reference: z.string().trim().min(1).max(64),
  amount: z.coerce.number().positive(),
  currency_code: z.string().trim().min(3).max(3).optional(),
  payment_date: z.string().optional(),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const applyVendorAdvanceSchema = z.object({
  purchase_invoice_id: z.string().uuid(),
  advance_payment_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
});
