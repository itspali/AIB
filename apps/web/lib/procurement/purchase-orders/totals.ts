import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
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
  grandTotal: number;
};

export type PurchaseOrderTotalsOptions = {
  purchasePricesTaxInclusive?: boolean;
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

  return {
    lineCount: lines.length,
    filledLineCount,
    subtotalGross,
    taxAmount,
    grandTotal: subtotalGross + taxAmount,
  };
}

export function formatPoMoney(value: number, decimalPlaces = 2): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
}
