import {
  filterSavableSoLines,
  type SoDraftLine,
} from "@/lib/sales/orders/draft-form";

export type SalesOrderTotalsSnapshot = {
  subtotal: number;
  totalTax: number;
  net: number;
};

export function computeSoLineGross(line: SoDraftLine): number {
  const qty = Number(line.quantity_ordered) || 0;
  const price = Number(line.unit_price_selling) || 0;
  const discPct = Number(line.discount_percentage) || 0;
  const discAmt = Number(line.discount_amount) || 0;
  const gross = qty * price;
  const afterPct = gross * (1 - discPct / 100);
  return Math.max(0, afterPct - discAmt);
}

export function computeSalesOrderDraftTotals(lines: SoDraftLine[]): SalesOrderTotalsSnapshot {
  const subtotal = filterSavableSoLines(lines).reduce(
    (sum, line) => sum + computeSoLineGross(line),
    0
  );
  return {
    subtotal,
    totalTax: 0,
    net: subtotal,
  };
}

export function formatSoMoney(value: number, currencyCode = "USD"): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
