export type PoShippingTaxType = "percent" | "amount";

import type { PoTransactionDiscountFields } from "@/lib/procurement/purchase-orders/po-transaction-discount";

export type PoHeaderChargesFields = PoTransactionDiscountFields & {
  shipping_amount: string;
  shipping_tax_rate_pct: string;
  shipping_tax_amount: string;
  shipping_tax_type?: PoShippingTaxType;
  round_off_amount: string;
  additional_charges_amount: string;
};

function parseAmount(value: string | undefined): number {
  const parsed = Number((value ?? "").trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function emptyPoHeaderCharges(): PoHeaderChargesFields {
  return {
    transaction_discount_percentage: "0",
    transaction_discount_amount: "0",
    transaction_discount_type: "percent",
    shipping_amount: "0",
    shipping_tax_rate_pct: "0",
    shipping_tax_amount: "0",
    shipping_tax_type: "percent",
    round_off_amount: "0",
    additional_charges_amount: "0",
  };
}

/** Shipping tax is always entered as a rate (%) applied to the shipping amount. */
export function resolvePoShippingTaxAmount(charges: PoHeaderChargesFields): number {
  const shipping = parseAmount(charges.shipping_amount);
  if (shipping <= 0) return 0;

  const rate = parseAmount(charges.shipping_tax_rate_pct);
  if (rate <= 0) return 0;
  return (shipping * rate) / 100;
}

export type PoHeaderChargesSnapshot = {
  shippingAmount: number;
  shippingTaxAmount: number;
  roundOffAmount: number;
  additionalChargesAmount: number;
  documentChargesTotal: number;
};

export function resolvePoHeaderChargesSnapshot(
  charges: PoHeaderChargesFields
): PoHeaderChargesSnapshot {
  const shippingAmount = parseAmount(charges.shipping_amount);
  const shippingTaxAmount = resolvePoShippingTaxAmount(charges);
  const roundOffAmount = parseAmount(charges.round_off_amount);
  const additionalChargesAmount = parseAmount(charges.additional_charges_amount);

  return {
    shippingAmount,
    shippingTaxAmount,
    roundOffAmount,
    additionalChargesAmount,
    documentChargesTotal:
      shippingAmount + shippingTaxAmount + roundOffAmount + additionalChargesAmount,
  };
}

/** Coerce legacy amount-mode rows to percent rate when loading from the database. */
export function normalizePoHeaderChargesFromStorage(
  charges: PoHeaderChargesFields
): PoHeaderChargesFields {
  if (charges.shipping_tax_type !== "amount") {
    return { ...charges, shipping_tax_type: "percent" };
  }

  const shipping = parseAmount(charges.shipping_amount);
  const tax = parseAmount(charges.shipping_tax_amount);
  const inferredRate =
    shipping > 0 && tax > 0 ? (tax / shipping) * 100 : parseAmount(charges.shipping_tax_rate_pct);

  return {
    ...charges,
    shipping_tax_rate_pct: String(inferredRate),
    shipping_tax_type: "percent",
  };
}

export function normalizePoHeaderChargesForSave(
  charges: PoHeaderChargesFields,
  options?: {
    roundOffAmount?: number;
    transactionDiscount?: {
      transaction_discount_percentage: number;
      transaction_discount_amount: number;
      transaction_discount_type: "percent" | "amount";
    };
  }
): {
  shipping_amount: number;
  shipping_tax_rate_pct: number;
  shipping_tax_amount: number;
  shipping_tax_type: PoShippingTaxType;
  round_off_amount: number;
  additional_charges_amount: number;
  transaction_discount_percentage: number;
  transaction_discount_amount: number;
  transaction_discount_type: "percent" | "amount";
} {
  const shippingAmount = Math.max(0, parseAmount(charges.shipping_amount));
  const roundOffAmount =
    options?.roundOffAmount !== undefined
      ? options.roundOffAmount
      : parseAmount(charges.round_off_amount);
  const additionalChargesAmount = Math.max(0, parseAmount(charges.additional_charges_amount));
  const percentCharges = normalizePoHeaderChargesFromStorage(charges);

  const transactionDiscount = options?.transactionDiscount ?? {
    transaction_discount_percentage: Math.max(0, parseAmount(charges.transaction_discount_percentage)),
    transaction_discount_amount: Math.max(0, parseAmount(charges.transaction_discount_amount)),
    transaction_discount_type:
      charges.transaction_discount_type === "amount" ? ("amount" as const) : ("percent" as const),
  };

  return {
    shipping_amount: shippingAmount,
    shipping_tax_rate_pct: Math.max(0, parseAmount(percentCharges.shipping_tax_rate_pct)),
    shipping_tax_amount: resolvePoShippingTaxAmount(percentCharges),
    shipping_tax_type: "percent",
    round_off_amount: roundOffAmount,
    additional_charges_amount: additionalChargesAmount,
    transaction_discount_percentage: transactionDiscount.transaction_discount_percentage,
    transaction_discount_amount: transactionDiscount.transaction_discount_amount,
    transaction_discount_type: transactionDiscount.transaction_discount_type,
  };
}
