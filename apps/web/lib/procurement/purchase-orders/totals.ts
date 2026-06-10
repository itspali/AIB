import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import type { GstTaxMechanism } from "@/lib/tax/gst-supply-context";
import {
  emptyPoHeaderCharges,
  resolvePoHeaderChargesSnapshot,
  type PoHeaderChargesFields,
} from "@/lib/procurement/purchase-orders/po-header-charges";
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
  const qty = parseAmount(line.quantity_ordered);
  const unit = parseAmount(line.unit_price_contractual);
  const lineDiscount = resolveLineDiscount(line);
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

export function computePurchaseOrderTotals(
  lines: PoLineTotalsInput[],
  options: PurchaseOrderTotalsOptions = {}
): PurchaseOrderTotalsSnapshot {
  let subtotalGross = 0;
  let taxAmount = 0;
  let filledLineCount = 0;

  for (const line of lines) {
    const variantReady = line.quantity_ordered.trim().length > 0;
    const qty = parseAmount(line.quantity_ordered);
    if (qty > 0) {
      filledLineCount += 1;
      const resolved = resolvePoLineTaxAmount(line, options);
      subtotalGross += resolved.taxableBase;
      taxAmount += resolved.taxAmount;
    } else if (variantReady) {
      filledLineCount += 1;
    }
  }

  const headerCharges = resolvePoHeaderChargesSnapshot(
    options.headerCharges ?? emptyPoHeaderCharges()
  );

  return {
    lineCount: lines.length,
    filledLineCount,
    subtotalGross,
    taxAmount,
    shippingAmount: headerCharges.shippingAmount,
    shippingTaxAmount: headerCharges.shippingTaxAmount,
    roundOffAmount: headerCharges.roundOffAmount,
    additionalChargesAmount: headerCharges.additionalChargesAmount,
    grandTotal:
      subtotalGross +
      taxAmount +
      headerCharges.shippingAmount +
      headerCharges.shippingTaxAmount +
      headerCharges.additionalChargesAmount +
      headerCharges.roundOffAmount,
  };
}

export function formatPoMoney(value: number, decimalPlaces = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
}
