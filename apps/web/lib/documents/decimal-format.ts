import type { DocumentColumnPref } from "@/lib/documents/types";

const DEFAULT_DECIMAL_PLACES_BY_COLUMN: Record<string, number> = {
  quantity_ordered: 3,
  quantity_received: 3,
  unit_price: 2,
  line_total: 2,
  discount_pct: 2,
  discount_amount: 2,
  tax_rate_pct: 2,
  line_tax_amount: 2,
  cgst_amount: 2,
  sgst_amount: 2,
  igst_amount: 2,
  subtotal_ex_tax: 2,
  tax_amount: 2,
  grand_total: 2,
};

export function resolveColumnDecimalPlaces(column: DocumentColumnPref): number {
  if (typeof column.decimalPlaces === "number") return column.decimalPlaces;
  return DEFAULT_DECIMAL_PLACES_BY_COLUMN[column.id] ?? 2;
}

export function formatDocumentDecimal(
  raw: string | number,
  decimalPlaces: number
): string {
  const parsed =
    typeof raw === "number" ? raw : Number(String(raw).trim().replace(/,/g, ""));
  if (!Number.isFinite(parsed)) {
    return typeof raw === "string" ? raw : "";
  }
  return parsed.toLocaleString(undefined, {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
}

/** Normalize user input to a fixed-precision decimal string for draft line storage. */
export function normalizeDocumentDecimalInput(
  raw: string,
  decimalPlaces: number
): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const parsed = Number(trimmed.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return trimmed;
  return parsed.toFixed(decimalPlaces);
}
