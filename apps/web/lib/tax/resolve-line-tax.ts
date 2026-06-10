export type ResolveLineTaxInput = {
  qty: number;
  unitPrice: number;
  lineDiscount: number;
  taxRate: number;
  pricesTaxInclusive: boolean;
  taxIsVariable?: boolean;
};

export type ResolvedLineTax = {
  taxableBase: number;
  taxAmount: number;
  lineTotal: number;
  taxRate: number;
};

function roundMoney(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

/** Client-side flat-rate tax mirror of `private.resolve_line_tax` (non-variable codes). */
export function resolveFlatLineTax(input: ResolveLineTaxInput): ResolvedLineTax {
  const qty = Math.max(input.qty, 0);
  const discountPerUnit = qty > 0 ? input.lineDiscount / qty : 0;
  const netUnit = Math.max(input.unitPrice - discountPerUnit, 0);
  const gross = roundMoney(netUnit * qty);

  if (input.taxIsVariable) {
    return {
      taxableBase: gross,
      taxAmount: 0,
      lineTotal: gross,
      taxRate: 0,
    };
  }

  const rate = Math.max(input.taxRate, 0);
  if (rate === 0) {
    return {
      taxableBase: gross,
      taxAmount: 0,
      lineTotal: gross,
      taxRate: 0,
    };
  }

  if (input.pricesTaxInclusive) {
    const taxableBase = roundMoney(gross / (1 + rate / 100));
    const taxAmount = roundMoney(gross - taxableBase);
    return {
      taxableBase,
      taxAmount,
      lineTotal: gross,
      taxRate: rate,
    };
  }

  const taxableBase = gross;
  const taxAmount = roundMoney(gross * (rate / 100));
  return {
    taxableBase,
    taxAmount,
    lineTotal: roundMoney(taxableBase + taxAmount),
    taxRate: rate,
  };
}
