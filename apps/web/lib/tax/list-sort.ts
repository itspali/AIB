import type { TaxListColumnId } from "@/lib/tax/list-columns";
import { formatTaxRateSummary } from "@/lib/tax/list-column-display-text";
import { taxCodeKindLabel, type TaxCodeRow } from "@/lib/tax/types";

export type TaxListSortDirection = "asc" | "desc";

export type TaxListSortField = TaxListColumnId;

export const DEFAULT_TAX_SORT_FIELD: TaxListSortField = "code";
export const DEFAULT_TAX_SORT_DIRECTION: TaxListSortDirection = "asc";

export type TaxSortOption = {
  field: TaxListSortField;
  direction: TaxListSortDirection;
  label: string;
};

export const TAX_SORT_OPTIONS: TaxSortOption[] = [
  { field: "code", direction: "asc", label: "Code (A–Z)" },
  { field: "code", direction: "desc", label: "Code (Z–A)" },
  { field: "name", direction: "asc", label: "Name (A–Z)" },
  { field: "name", direction: "desc", label: "Name (Z–A)" },
  { field: "kind", direction: "asc", label: "Kind (A–Z)" },
  { field: "rate", direction: "desc", label: "Rate (high–low)" },
  { field: "rate", direction: "asc", label: "Rate (low–high)" },
  { field: "updated_at", direction: "desc", label: "Updated (newest)" },
  { field: "updated_at", direction: "asc", label: "Updated (oldest)" },
];

export function taxSortOptionKey(field: string, direction: TaxListSortDirection): string {
  return `${field}:${direction}`;
}

const DESC_FIRST = new Set<string>(["rate", "updated_at"]);

export function getInitialTaxSortDirection(field: string): TaxListSortDirection {
  return DESC_FIRST.has(field) ? "desc" : "asc";
}

export function toggleTaxColumnSort(
  field: TaxListSortField,
  activeField: TaxListSortField,
  activeDirection: TaxListSortDirection
): { field: TaxListSortField; direction: TaxListSortDirection } {
  if (field !== activeField) {
    return { field, direction: getInitialTaxSortDirection(field) };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}

function directionMultiplier(direction: TaxListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: TaxListSortDirection
): number {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return directionMultiplier(direction) * left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareNumbers(a: number, b: number, direction: TaxListSortDirection): number {
  return directionMultiplier(direction) * (a - b);
}

function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: TaxListSortDirection
): number {
  const left = a ? Date.parse(a) : Number.NaN;
  const right = b ? Date.parse(b) : Number.NaN;
  const leftValid = Number.isFinite(left);
  const rightValid = Number.isFinite(right);
  if (!leftValid && !rightValid) return 0;
  if (!leftValid) return 1;
  if (!rightValid) return -1;
  return directionMultiplier(direction) * (left - right);
}

function resolveSortRate(row: TaxCodeRow): number {
  if (row.is_variable) {
    const rates = row.rules.map((rule) => rule.rate);
    return rates.length > 0 ? Math.max(...rates) : 0;
  }
  return row.rate;
}

export function sortTaxCodeRows(
  rows: TaxCodeRow[],
  field: TaxListSortField,
  direction: TaxListSortDirection
): TaxCodeRow[] {
  return [...rows].sort((a, b) => {
    let primary = 0;
    switch (field) {
      case "code":
        primary = compareStrings(a.code, b.code, direction);
        break;
      case "name":
        primary = compareStrings(a.name, b.name, direction);
        break;
      case "kind":
        primary = compareStrings(taxCodeKindLabel(a.kind), taxCodeKindLabel(b.kind), direction);
        break;
      case "rate":
        primary = compareNumbers(resolveSortRate(a), resolveSortRate(b), direction);
        break;
      case "is_active":
        primary = compareNumbers(Number(a.is_active), Number(b.is_active), direction);
        break;
      case "is_variable":
        primary = compareNumbers(Number(a.is_variable), Number(b.is_variable), direction);
        break;
      case "is_recoverable":
        primary = compareNumbers(Number(a.is_recoverable), Number(b.is_recoverable), direction);
        break;
      case "components":
        primary = compareStrings(
          a.components.map((component) => component.name).join(", "),
          b.components.map((component) => component.name).join(", "),
          direction
        );
        break;
      case "effective_from":
        primary = compareDates(a.effective_from, b.effective_from, direction);
        break;
      case "effective_to":
        primary = compareDates(a.effective_to, b.effective_to, direction);
        break;
      case "updated_at":
        primary = compareDates(a.updated_at, b.updated_at, direction);
        break;
    }
    if (primary !== 0) return primary;
    return compareStrings(a.code, b.code, "asc");
  });
}

export function isSortableTaxColumn(id: string): id is TaxListSortField {
  return (
    [
      "code",
      "name",
      "kind",
      "rate",
      "is_active",
      "is_variable",
      "is_recoverable",
      "components",
      "effective_from",
      "effective_to",
      "updated_at",
    ] as const
  ).includes(id as TaxListSortField);
}

export function formatTaxRateSortText(row: TaxCodeRow): string {
  return formatTaxRateSummary(row);
}
