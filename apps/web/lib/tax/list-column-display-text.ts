import { formatDate } from "@/lib/dashboard/format";
import type { TaxListColumnId } from "@/lib/tax/list-columns";
import { taxCodeKindLabel, type TaxCodeRow } from "@/lib/tax/types";

export function formatTaxRateSummary(row: TaxCodeRow): string {
  if (row.is_variable) {
    if (row.rules.length === 0) return "Variable";
    const rates = row.rules.map((rule) => rule.rate);
    const min = Math.min(...rates);
    const max = Math.max(...rates);
    return min === max ? `${min}% (slab)` : `${min}–${max}% (slab)`;
  }
  return `${row.rate}%`;
}

export function formatTaxComponentsSummary(row: TaxCodeRow): string {
  if (row.components.length === 0) return "—";
  return row.components.map((component) => `${component.name} ${component.rate}%`).join(" + ");
}

export function getTaxCellDisplayTexts(columnId: TaxListColumnId, row: TaxCodeRow): string[] {
  switch (columnId) {
    case "code":
      return [row.code];
    case "name":
      return [row.name];
    case "kind":
      return [taxCodeKindLabel(row.kind)];
    case "rate":
      return [formatTaxRateSummary(row)];
    case "is_active":
      return [row.is_active ? "Active" : "Inactive"];
    case "is_variable":
      return [row.is_variable ? "Yes" : "No"];
    case "is_recoverable":
      return [row.is_recoverable ? "Yes" : "No"];
    case "components":
      return [formatTaxComponentsSummary(row)];
    case "effective_from":
      return [row.effective_from ? formatDate(row.effective_from) : "—"];
    case "effective_to":
      return [row.effective_to ? formatDate(row.effective_to) : "—"];
    case "updated_at":
      return [formatDate(row.updated_at)];
    default:
      return ["—"];
  }
}
