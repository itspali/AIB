import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";
import {
  computePoAutoRoundOff,
  type PoAutoRoundOffPolicy,
} from "@/lib/procurement/purchase-orders/po-auto-round-off";
import {
  emptyPoHeaderCharges,
  normalizePoHeaderChargesForSave,
  resolvePoHeaderChargesSnapshot,
  type PoHeaderChargesFields,
} from "@/lib/procurement/purchase-orders/po-header-charges";
import {
  apportionTransactionDiscount,
  normalizeTransactionDiscountForSave,
  resolveTransactionDiscount,
} from "@/lib/procurement/purchase-orders/po-transaction-discount";
import { resolveFlatLineTax } from "@/lib/tax/resolve-line-tax";

export type PoLineTotalsInput = {
  quantity_ordered: string;
  unit_price_contractual: string;
  discount_percentage?: string;
  discount_amount?: string;
  discount_type?: "percent" | "amount";
  catalog_context?: PoLineCatalogContext | null;
};

export type PurchaseOrderTotalsSnapshot = {
  lineCount: number;
  filledLineCount: number;
  subtotalGross: number;
  transactionDiscountAmount: number;
  taxAmount: number;
  shippingAmount: number;
  shippingTaxAmount: number;
  roundOffAmount: number;
  additionalChargesAmount: number;
  grandTotal: number;
};

export type PurchaseOrderTotalsOptions = {
  purchasePricesTaxInclusive?: boolean;
  taxMechanism?: GstTaxMechanism;
  headerCharges?: PoHeaderChargesFields;
  autoRoundOff?: PoAutoRoundOffPolicy;
  allowTransactionDiscounts?: boolean;
};

function parseAmount(value: string | undefined): number {
  const parsed = Number((value ?? "").trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function lineExtension(line: PoLineTotalsInput): number {
  const qty = parseAmount(line.quantity_ordered);
  const unit = parseAmount(line.unit_price_contractual);
  if (qty <= 0) return 0;
  return qty * unit;
}

/** Discount applied to a line extension (respects explicit entry mode when set). */
export function resolveLineDiscount(
  line: PoLineTotalsInput & { discount_type?: "percent" | "amount" }
): number {
  const extension = lineExtension(line);
  if (extension <= 0) return 0;

  const type =
    line.discount_type ??
    (parseAmount(line.discount_amount) > 0 ? ("amount" as const) : ("percent" as const));

  if (type === "amount") {
    const discountAmount = parseAmount(line.discount_amount);
    if (discountAmount <= 0) return 0;
    return Math.min(discountAmount, extension);
  }

  const discountPct = parseAmount(line.discount_percentage);
  if (discountPct <= 0) return 0;
  return Math.min(extension, (extension * discountPct) / 100);
}

function resolvePoLineTaxAmountWithExtraDiscount(
  line: PoLineTotalsInput,
  extraLineDiscount: number,
  options: PurchaseOrderTotalsOptions = {}
): { taxableBase: number; taxAmount: number; lineTotal: number } {
  const qty = parseAmount(line.quantity_ordered);
  const unit = parseAmount(line.unit_price_contractual);
  const lineDiscount = resolveLineDiscount(line) + Math.max(extraLineDiscount, 0);
  const catalog = line.catalog_context;
  const pricesTaxInclusive = options.purchasePricesTaxInclusive ?? false;

  return resolveFlatLineTax({
    qty,
    unitPrice: unit,
    lineDiscount,
    taxRate: catalog?.tax_rate ?? 0,
    taxIsVariable: catalog?.tax_is_variable,
    pricesTaxInclusive,
    taxMechanism: options.taxMechanism,
  });
}

/** Ex-tax line net after discount (matches persisted `line_total_gross`). */
export function computeLineGross(
  line: PoLineTotalsInput,
  options: PurchaseOrderTotalsOptions = {}
): number {
  const qty = parseAmount(line.quantity_ordered);
  if (qty <= 0) return 0;
  return resolvePoLineTaxAmount(line, options).taxableBase;
}

export function resolvePoLineTaxAmount(
  line: PoLineTotalsInput,
  options: PurchaseOrderTotalsOptions = {}
): { taxableBase: number; taxAmount: number; lineTotal: number } {
  return resolvePoLineTaxAmountWithExtraDiscount(line, 0, options);
}

export function computePurchaseOrderTotals(
  lines: PoLineTotalsInput[],
  options: PurchaseOrderTotalsOptions = {}
): PurchaseOrderTotalsSnapshot {
  const headerCharges = options.headerCharges ?? emptyPoHeaderCharges();
  const lineStates: Array<{
    line: PoLineTotalsInput;
    preTransactionTaxableBase: number;
  }> = [];

  let subtotalGross = 0;
  let filledLineCount = 0;

  for (const line of lines) {
    const variantReady = line.quantity_ordered.trim().length > 0;
    const qty = parseAmount(line.quantity_ordered);
    if (qty > 0) {
      filledLineCount += 1;
      const preTransaction = resolvePoLineTaxAmount(line, options);
      subtotalGross += preTransaction.taxableBase;
      lineStates.push({
        line,
        preTransactionTaxableBase: preTransaction.taxableBase,
      });
    } else if (variantReady) {
      filledLineCount += 1;
    }
  }

  const transactionDiscountAmount =
    options.allowTransactionDiscounts === false
      ? 0
      : resolveTransactionDiscount(subtotalGross, headerCharges);

  const apportionedShares = apportionTransactionDiscount(
    lineStates.map((state) => state.preTransactionTaxableBase),
    transactionDiscountAmount
  );

  let taxAmount = 0;
  for (let index = 0; index < lineStates.length; index += 1) {
    const state = lineStates[index];
    if (!state) continue;
    const resolved = resolvePoLineTaxAmountWithExtraDiscount(
      state.line,
      apportionedShares[index] ?? 0,
      options
    );
    taxAmount += resolved.taxAmount;
  }

  const headerSnapshot = resolvePoHeaderChargesSnapshot(headerCharges);

  const preRoundTotal =
    subtotalGross -
    transactionDiscountAmount +
    taxAmount +
    headerSnapshot.shippingAmount +
    headerSnapshot.shippingTaxAmount +
    headerSnapshot.additionalChargesAmount;

  const autoRoundOff = options.autoRoundOff;
  if (autoRoundOff?.enabled) {
    const { roundOffAmount, grandTotal } = computePoAutoRoundOff(
      preRoundTotal,
      autoRoundOff.step
    );
    return {
      lineCount: lines.length,
      filledLineCount,
      subtotalGross,
      transactionDiscountAmount,
      taxAmount,
      shippingAmount: headerSnapshot.shippingAmount,
      shippingTaxAmount: headerSnapshot.shippingTaxAmount,
      roundOffAmount,
      additionalChargesAmount: headerSnapshot.additionalChargesAmount,
      grandTotal,
    };
  }

  return {
    lineCount: lines.length,
    filledLineCount,
    subtotalGross,
    transactionDiscountAmount,
    taxAmount,
    shippingAmount: headerSnapshot.shippingAmount,
    shippingTaxAmount: headerSnapshot.shippingTaxAmount,
    roundOffAmount: headerSnapshot.roundOffAmount,
    additionalChargesAmount: headerSnapshot.additionalChargesAmount,
    grandTotal: preRoundTotal + headerSnapshot.roundOffAmount,
  };
}

export function resolvePoHeaderChargesForSave(
  charges: PoHeaderChargesFields,
  lines: PoLineTotalsInput[],
  options: PurchaseOrderTotalsOptions = {}
) {
  const totals = computePurchaseOrderTotals(lines, options);
  const transactionDiscount =
    options.allowTransactionDiscounts === false
      ? {
          transaction_discount_percentage: 0,
          transaction_discount_amount: 0,
          transaction_discount_type: "percent" as const,
        }
      : normalizeTransactionDiscountForSave(charges, totals.subtotalGross);

  return normalizePoHeaderChargesForSave(
    charges,
    options.autoRoundOff?.enabled
      ? {
          roundOffAmount: totals.roundOffAmount,
          transactionDiscount,
        }
      : { transactionDiscount }
  );
}

export function formatPoMoney(value: number, decimalPlaces = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
}
