const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
] as const;

const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"] as const;

function twoDigitWords(value: number): string {
  if (value < 20) return ONES[value] ?? "";
  const tens = Math.floor(value / 10);
  const ones = value % 10;
  return `${TENS[tens] ?? ""}${ones ? ` ${ONES[ones]}` : ""}`.trim();
}

function threeDigitWords(value: number): string {
  if (value === 0) return "";
  const hundreds = Math.floor(value / 100);
  const remainder = value % 100;
  const hundredPart = hundreds ? `${ONES[hundreds]} Hundred` : "";
  const remainderPart = remainder ? twoDigitWords(remainder) : "";
  return [hundredPart, remainderPart].filter(Boolean).join(" ");
}

function indianNumberWords(value: number): string {
  if (value === 0) return "Zero";

  const crore = Math.floor(value / 10_000_000);
  const lakh = Math.floor((value % 10_000_000) / 100_000);
  const thousand = Math.floor((value % 100_000) / 1_000);
  const remainder = value % 1_000;

  const parts: string[] = [];
  if (crore) parts.push(`${threeDigitWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitWords(thousand)} Thousand`);
  if (remainder) parts.push(threeDigitWords(remainder));

  return parts.join(" ").trim();
}

/** Parse formatted currency strings like "₹4,432.00" or "4,432.00" into paise-safe integer rupees. */
export function parsePrintAmountToRupees(raw: string): number | null {
  const normalized = raw.replace(/[^\d.,-]/g, "").replace(/,/g, "");
  if (!normalized) return null;
  const value = Number.parseFloat(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

/**
 * Convert a rupee amount to English words (Indian numbering: Lakh, Crore).
 * Returns null when the amount cannot be parsed.
 */
export function amountInWordsInr(rawAmount: string, currencyLabel = "Rupees"): string | null {
  const rupees = parsePrintAmountToRupees(rawAmount);
  if (rupees == null) return null;
  return `${indianNumberWords(rupees)} ${currencyLabel} Only`;
}
