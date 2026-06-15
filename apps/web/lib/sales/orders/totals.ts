import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import {
  computePurchaseOrderTotals,
  type PoLineTotalsInput,
} from "@/lib/procurement/purchase-orders/totals";
import {
  normalizeTransactionDiscountForSave,
} from "@/lib/procurement/purchase-orders/po-transaction-discount";
import {
  emptySalesHeaderCharges,
  normalizeSalesHeaderChargesForSave,
  resolveSalesHeaderChargesSnapshot,
  type SalesHeaderChargesFields,
} from "@/lib/sales/shared/sales-header-charges";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";

export type SalesLineTotalsInput = {
  quantity_ordered?: string;
  quantity_quoted?: string;
  quantity_invoiced?: string;
  unit_price_selling: string;
  discount_percentage?: string;
  discount_amount?: string;
  discount_type?: "percent" | "amount";
  catalog_context?: PoLineCatalogContext | null;
};

export type SalesCommerceTotalsSnapshot = {
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

/** @deprecated Use SalesCommerceTotalsSnapshot */
export type SalesOrderTotalsSnapshot = SalesCommerceTotalsSnapshot & {
  subtotal: number;
  totalTax: number;
  net: number;
};

export type SalesCommerceTotalsOptions = {
  sellingPricesTaxInclusive?: boolean;
  taxMechanism?: GstTaxMechanism;
  headerCharges?: SalesHeaderChargesFields;
  allowTransactionDiscounts?: boolean;
};

function parseAmount(value: string | undefined): number {
  const parsed = Number((value ?? "").trim().replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function resolveLineQuantity(line: SalesLineTotalsInput): number {
  const qty =
    parseAmount(line.quantity_ordered) ||
    parseAmount(line.quantity_quoted) ||
    parseAmount(line.quantity_invoiced);
  return qty;
}

export function computeSalesLineGross(line: SalesLineTotalsInput): number {
  const qty = resolveLineQuantity(line);
  const price = parseAmount(line.unit_price_selling);
  const discPct = parseAmount(line.discount_percentage);
  const discAmt = parseAmount(line.discount_amount);
  const gross = qty * price;
  const afterPct = gross * (1 - discPct / 100);
  return Math.max(0, afterPct - discAmt);
}

/** @deprecated Use computeSalesLineGross */
export function computeSoLineGross(line: SalesLineTotalsInput): number {
  return computeSalesLineGross(line);
}

function toPoLineTotalsInput(line: SalesLineTotalsInput): PoLineTotalsInput {
  return {
    quantity_ordered:
      line.quantity_ordered ?? line.quantity_quoted ?? line.quantity_invoiced ?? "",
    unit_price_contractual: line.unit_price_selling,
    discount_percentage: line.discount_percentage,
    discount_amount: line.discount_amount,
    discount_type: line.discount_type,
    catalog_context: line.catalog_context,
  };
}

export function computeSalesCommerceDraftTotals(
  lines: SalesLineTotalsInput[],
  options: SalesCommerceTotalsOptions = {}
): SalesCommerceTotalsSnapshot {
  const poTotals = computePurchaseOrderTotals(
    lines.map(toPoLineTotalsInput),
    {
      purchasePricesTaxInclusive: options.sellingPricesTaxInclusive ?? false,
      taxMechanism: options.taxMechanism,
      headerCharges: options.headerCharges ?? emptySalesHeaderCharges(),
      allowTransactionDiscounts: options.allowTransactionDiscounts,
    }
  );

  return {
    lineCount: poTotals.lineCount,
    filledLineCount: poTotals.filledLineCount,
    subtotalGross: poTotals.subtotalGross,
    transactionDiscountAmount: poTotals.transactionDiscountAmount,
    taxAmount: poTotals.taxAmount,
    shippingAmount: poTotals.shippingAmount,
    shippingTaxAmount: poTotals.shippingTaxAmount,
    roundOffAmount: poTotals.roundOffAmount,
    additionalChargesAmount: poTotals.additionalChargesAmount,
    grandTotal: poTotals.grandTotal,
  };
}

export function computeSalesOrderDraftTotals(
  lines: SalesLineTotalsInput[],
  options: SalesCommerceTotalsOptions = {}
): SalesOrderTotalsSnapshot {
  const totals = computeSalesCommerceDraftTotals(lines, options);
  return {
    ...totals,
    subtotal: totals.subtotalGross,
    totalTax: totals.taxAmount,
    net: totals.grandTotal,
  };
}

export function resolveSalesHeaderChargesForSave(
  charges: SalesHeaderChargesFields,
  lines: SalesLineTotalsInput[],
  options: SalesCommerceTotalsOptions = {}
) {
  const totals = computeSalesCommerceDraftTotals(lines, options);
  const transactionDiscount =
    options.allowTransactionDiscounts === false
      ? {
          transaction_discount_percentage: 0,
          transaction_discount_amount: 0,
          transaction_discount_type: "percent" as const,
        }
      : normalizeTransactionDiscountForSave(charges, totals.subtotalGross);

  return normalizeSalesHeaderChargesForSave(charges, { transactionDiscount });
}

export function formatSoMoney(value: number, decimalPlaces = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
}

export function formatSoMoneyWithCurrency(
  value: number,
  currencyCode = "USD",
  decimalPlaces = 2
): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(value);
}
