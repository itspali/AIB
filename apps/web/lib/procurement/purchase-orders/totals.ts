export type PoLineTotalsInput = {
  quantity_ordered: string;
  unit_price_contractual: string;
};

export type PurchaseOrderTotalsSnapshot = {
  lineCount: number;
  filledLineCount: number;
  subtotalGross: number;
  taxAmount: number;
  grandTotal: number;
};

function parseAmount(value: string): number {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

export function computeLineGross(line: PoLineTotalsInput): number {
  const qty = parseAmount(line.quantity_ordered);
  const unit = parseAmount(line.unit_price_contractual);
  if (qty <= 0) return 0;
  return qty * unit;
}

export function computePurchaseOrderTotals(
  lines: PoLineTotalsInput[]
): PurchaseOrderTotalsSnapshot {
  let subtotalGross = 0;
  let filledLineCount = 0;

  for (const line of lines) {
    const variantReady = line.quantity_ordered.trim().length > 0;
    const qty = parseAmount(line.quantity_ordered);
    if (qty > 0) {
      filledLineCount += 1;
      subtotalGross += computeLineGross(line);
    } else if (variantReady) {
      filledLineCount += 1;
    }
  }

  const taxAmount = 0;

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
