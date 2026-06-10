import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";

export type PoTransactionDiscountType = "percent" | "amount";

export type PoTransactionDiscountFields = {
  transaction_discount_percentage: string;
  transaction_discount_amount: string;
  transaction_discount_type?: PoTransactionDiscountType;
};

function parseAmount(value: string | undefined): number {
  const parsed = Number((value ?? "").trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePositiveAmount(value: string | undefined): number {
  const parsed = parseAmount(value);
  return parsed > 0 ? parsed : 0;
}

export function inferPoTransactionDiscountTypeFromSaved(
  order: Pick<
    PurchaseOrderRow,
    "transaction_discount_percentage" | "transaction_discount_amount" | "transaction_discount_type"
  >
): PoTransactionDiscountType {
  if (order.transaction_discount_type === "amount" || order.transaction_discount_type === "percent") {
    return order.transaction_discount_type;
  }
  if (parsePositiveAmount(order.transaction_discount_amount) > 0) return "amount";
  return "percent";
}

export function resolvePoTransactionDiscountType(
  fields: PoTransactionDiscountFields
): PoTransactionDiscountType {
  if (
    fields.transaction_discount_type === "percent" ||
    fields.transaction_discount_type === "amount"
  ) {
    return fields.transaction_discount_type;
  }
  if (parsePositiveAmount(fields.transaction_discount_amount) > 0) return "amount";
  return "percent";
}

export function resolvePoTransactionDiscountInputValue(fields: PoTransactionDiscountFields): string {
  return resolvePoTransactionDiscountType(fields) === "amount"
    ? fields.transaction_discount_amount
    : fields.transaction_discount_percentage;
}

/** Resolved trade discount amount capped at subtotal (ex tax, after line discounts). */
export function resolveTransactionDiscount(
  subtotalAfterLineDiscounts: number,
  fields: PoTransactionDiscountFields
): number {
  const subtotal = Math.max(subtotalAfterLineDiscounts, 0);
  if (subtotal <= 0) return 0;

  const type = resolvePoTransactionDiscountType(fields);

  if (type === "amount") {
    const amount = parsePositiveAmount(fields.transaction_discount_amount);
    if (amount <= 0) return 0;
    return Math.min(amount, subtotal);
  }

  const pct = parsePositiveAmount(fields.transaction_discount_percentage);
  if (pct <= 0) return 0;
  return Math.min(subtotal, (subtotal * pct) / 100);
}

/** Proportional split with penny drift absorbed on the last line. */
export function apportionTransactionDiscount(
  lineTaxableBases: readonly number[],
  transactionDiscount: number
): number[] {
  const count = lineTaxableBases.length;
  if (count === 0 || transactionDiscount <= 0) {
    return lineTaxableBases.map(() => 0);
  }

  const total = lineTaxableBases.reduce((sum, base) => sum + Math.max(base, 0), 0);
  if (total <= 0) {
    return lineTaxableBases.map(() => 0);
  }

  const shares: number[] = [];
  let allocated = 0;

  for (let index = 0; index < count; index += 1) {
    if (index === count - 1) {
      shares.push(Math.max(transactionDiscount - allocated, 0));
      break;
    }

    const share = Math.round(((transactionDiscount * Math.max(lineTaxableBases[index] ?? 0, 0)) / total) * 10_000) / 10_000;
    shares.push(share);
    allocated += share;
  }

  return shares;
}

export function patchPoTransactionDiscountPercentInput(
  raw: string
): Pick<
  PoTransactionDiscountFields,
  "transaction_discount_type" | "transaction_discount_percentage" | "transaction_discount_amount"
> {
  return {
    transaction_discount_type: "percent",
    transaction_discount_percentage: raw,
    transaction_discount_amount: "0",
  };
}

export function patchPoTransactionDiscountAmountInput(
  raw: string
): Pick<
  PoTransactionDiscountFields,
  "transaction_discount_type" | "transaction_discount_percentage" | "transaction_discount_amount"
> {
  return {
    transaction_discount_type: "amount",
    transaction_discount_percentage: "0",
    transaction_discount_amount: raw,
  };
}

export function patchPoTransactionDiscountType(
  fields: PoTransactionDiscountFields,
  type: PoTransactionDiscountType
): Pick<
  PoTransactionDiscountFields,
  "transaction_discount_type" | "transaction_discount_percentage" | "transaction_discount_amount"
> {
  if (type === "amount") {
    return {
      transaction_discount_type: "amount",
      transaction_discount_percentage: "0",
      transaction_discount_amount: fields.transaction_discount_amount,
    };
  }
  return {
    transaction_discount_type: "percent",
    transaction_discount_percentage: fields.transaction_discount_percentage,
    transaction_discount_amount: "0",
  };
}

export function normalizeTransactionDiscountForSave(
  fields: PoTransactionDiscountFields,
  subtotalAfterLineDiscounts: number
): {
  transaction_discount_percentage: number;
  transaction_discount_amount: number;
  transaction_discount_type: PoTransactionDiscountType;
} {
  const type = resolvePoTransactionDiscountType(fields);
  const resolvedAmount = resolveTransactionDiscount(subtotalAfterLineDiscounts, fields);

  if (type === "amount") {
    return {
      transaction_discount_percentage: 0,
      transaction_discount_amount: resolvedAmount,
      transaction_discount_type: "amount",
    };
  }

  return {
    transaction_discount_percentage: Math.max(0, parseAmount(fields.transaction_discount_percentage)),
    transaction_discount_amount: resolvedAmount,
    transaction_discount_type: "percent",
  };
}

export function emptyPoTransactionDiscountFields(): PoTransactionDiscountFields {
  return {
    transaction_discount_percentage: "0",
    transaction_discount_amount: "0",
    transaction_discount_type: "percent",
  };
}

export function mapPurchaseOrderTransactionDiscount(
  order: PurchaseOrderRow
): PoTransactionDiscountFields {
  return {
    transaction_discount_percentage: order.transaction_discount_percentage ?? "0",
    transaction_discount_amount: order.transaction_discount_amount ?? "0",
    transaction_discount_type: inferPoTransactionDiscountTypeFromSaved(order),
  };
}
