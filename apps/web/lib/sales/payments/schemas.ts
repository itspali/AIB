import { z } from "zod";

export const GATEWAY_PROVIDER_TYPES = [
  "STRIPE",
  "RAZORPAY",
  "PAYPAL",
  "INTERNAL_CREDIT",
  "BANK_TRANSFER",
  "CASH_ON_DELIVERY",
] as const;

export const saveCustomerPaymentSchema = z.object({
  customer_id: z.string().uuid("Select a customer."),
  amount_received: z
    .number({ invalid_type_error: "Amount is required." })
    .positive("Amount must be greater than zero."),
  payment_method: z.enum(GATEWAY_PROVIDER_TYPES),
  reference_number: z.string().trim().max(128).optional().nullable(),
  currency_code: z.string().trim().length(3).optional().nullable(),
  exchange_rate: z.number().positive().optional().nullable(),
  received_at: z.string().trim().optional().nullable(),
});

export type SaveCustomerPaymentInput = z.infer<typeof saveCustomerPaymentSchema>;

export const applyCustomerPaymentSchema = z.object({
  payment_id: z.string().uuid("Payment id is required."),
  invoice_id: z.string().uuid("Invoice id is required."),
  amount: z
    .number({ invalid_type_error: "Amount is required." })
    .positive("Amount must be greater than zero."),
});

export type ApplyCustomerPaymentInput = z.infer<typeof applyCustomerPaymentSchema>;
