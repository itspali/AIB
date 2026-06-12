const COMPUTE_SCALE = 8;
const MONEY_SCALE = 4;

export function computeNumeric(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** COMPUTE_SCALE;
  return Math.round(value * factor) / factor;
}

export function moneyNumeric(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** MONEY_SCALE;
  return Math.round(value * factor) / factor;
}

export function formatMoneyDetail(value: number, currencyCode = ""): string {
  const formatted = moneyNumeric(value).toFixed(MONEY_SCALE);
  return currencyCode ? `${formatted} ${currencyCode}` : formatted;
}
