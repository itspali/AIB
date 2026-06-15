import { z } from "zod";
import {
  resolveSalesHeaderChargesForSave,
  type SalesCommerceTotalsOptions,
} from "@/lib/sales/orders/totals";
import type { SalesHeaderChargesFields } from "@/lib/sales/shared/sales-header-charges";
import type { SalesLineTotalsInput } from "@/lib/sales/orders/totals";

export const salesCommerceRpcExtrasSchema = z.object({
  currency_code: z.string().trim().length(3).optional().nullable(),
  exchange_rate: z.string().trim().optional().nullable(),
  prices_tax_inclusive: z.boolean().optional().nullable(),
  payment_terms_days: z.number().int().min(0).optional().nullable(),
  shipping_amount: z.string().trim().optional(),
  shipping_tax_rate_pct: z.string().trim().optional(),
  round_off_amount: z.string().trim().optional(),
  additional_charges_amount: z.string().trim().optional(),
  transaction_discount_percentage: z.string().trim().optional(),
  transaction_discount_amount: z.string().trim().optional(),
  transaction_discount_type: z.enum(["percent", "amount"]).optional(),
});

export type SalesCommerceRpcExtrasInput = z.infer<typeof salesCommerceRpcExtrasSchema>;

function parseAmount(value: string | undefined): number {
  const parsed = Number((value ?? "").trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildSalesCommerceSaveExtras(
  form: {
    currency_code: string;
    payment_terms_days: string;
    prices_tax_inclusive: boolean;
    header_charges: SalesHeaderChargesFields;
  },
  lines: SalesLineTotalsInput[],
  options?: Pick<SalesCommerceTotalsOptions, "allowTransactionDiscounts">
): SalesCommerceRpcExtrasInput {
  const headerCharges = resolveSalesHeaderChargesForSave(form.header_charges, lines, {
    headerCharges: form.header_charges,
    sellingPricesTaxInclusive: form.prices_tax_inclusive,
    allowTransactionDiscounts: options?.allowTransactionDiscounts,
  });

  return {
    currency_code: form.currency_code,
    prices_tax_inclusive: form.prices_tax_inclusive,
    payment_terms_days: Number(form.payment_terms_days) || 0,
    shipping_amount: String(headerCharges.shipping_amount),
    shipping_tax_rate_pct: String(headerCharges.shipping_tax_rate_pct),
    round_off_amount: String(headerCharges.round_off_amount),
    additional_charges_amount: String(headerCharges.additional_charges_amount),
    transaction_discount_percentage: String(headerCharges.transaction_discount_percentage),
    transaction_discount_amount: String(headerCharges.transaction_discount_amount),
    transaction_discount_type: headerCharges.transaction_discount_type,
  };
}

export function mapSalesCommerceRpcExtrasInput(extras: SalesCommerceRpcExtrasInput) {
  return {
    p_currency_code: extras.currency_code ?? null,
    p_exchange_rate: extras.exchange_rate ? Number(extras.exchange_rate) : null,
    p_prices_tax_inclusive: extras.prices_tax_inclusive ?? null,
    p_payment_terms_days: extras.payment_terms_days ?? null,
    p_shipping_amount: parseAmount(extras.shipping_amount),
    p_shipping_tax_rate_pct: parseAmount(extras.shipping_tax_rate_pct),
    p_round_off_amount: parseAmount(extras.round_off_amount),
    p_additional_charges_amount: parseAmount(extras.additional_charges_amount),
    p_transaction_discount_percentage: parseAmount(extras.transaction_discount_percentage),
    p_transaction_discount_amount: parseAmount(extras.transaction_discount_amount),
  };
}
