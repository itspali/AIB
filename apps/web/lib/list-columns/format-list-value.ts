import { formatCurrency } from "@/lib/dashboard/format";

const quantityFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 4,
});

/** Currency amounts in list/matrix cells — matches Items master formatting. */
export function formatListCurrency(
  value: string | number | null | undefined,
  empty = "—"
): string {
  if (value == null) return empty;
  if (typeof value === "string" && value.trim() === "") return empty;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? formatCurrency(parsed) : String(value);
}

/** Quantities, counts, and other numeric list values — locale grouping without currency symbol. */
export function formatListQuantity(
  value: string | number | null | undefined,
  empty = "—"
): string {
  if (value == null) return empty;
  if (typeof value === "string" && value.trim() === "") return empty;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? quantityFormatter.format(parsed) : String(value);
}
