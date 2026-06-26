import type { UomListColumnId } from "@/lib/uom/list-columns";
import { uomFamilyLabel, type UomRow } from "@/lib/uom/types";

export type UomListSortDirection = "asc" | "desc";

export type UomListSortField = UomListColumnId;

export const DEFAULT_UOM_SORT_FIELD: UomListSortField = "family";
export const DEFAULT_UOM_SORT_DIRECTION: UomListSortDirection = "asc";

export type UomSortOption = {
  field: UomListSortField;
  direction: UomListSortDirection;
  label: string;
};

export const UOM_SORT_OPTIONS: UomSortOption[] = [
  { field: "family", direction: "asc", label: "Family (A–Z)" },
  { field: "family", direction: "desc", label: "Family (Z–A)" },
  { field: "code", direction: "asc", label: "Code (A–Z)" },
  { field: "code", direction: "desc", label: "Code (Z–A)" },
  { field: "name", direction: "asc", label: "Name (A–Z)" },
  { field: "name", direction: "desc", label: "Name (Z–A)" },
  { field: "factor_to_base", direction: "desc", label: "Factor (high–low)" },
  { field: "factor_to_base", direction: "asc", label: "Factor (low–high)" },
  { field: "updated_at", direction: "desc", label: "Updated (newest)" },
  { field: "updated_at", direction: "asc", label: "Updated (oldest)" },
];

export function uomSortOptionKey(field: string, direction: UomListSortDirection): string {
  return `${field}:${direction}`;
}

const DESC_FIRST = new Set<string>(["factor_to_base", "updated_at"]);

export function getInitialUomSortDirection(field: string): UomListSortDirection {
  return DESC_FIRST.has(field) ? "desc" : "asc";
}

export function toggleUomColumnSort(
  field: UomListSortField,
  activeField: UomListSortField,
  activeDirection: UomListSortDirection
): { field: UomListSortField; direction: UomListSortDirection } {
  if (field !== activeField) {
    return { field, direction: getInitialUomSortDirection(field) };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}

function directionMultiplier(direction: UomListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: UomListSortDirection
): number {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return directionMultiplier(direction) * left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareNumbers(a: number, b: number, direction: UomListSortDirection): number {
  return directionMultiplier(direction) * (a - b);
}

function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: UomListSortDirection
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

export function sortUomRows(
  rows: UomRow[],
  field: UomListSortField,
  direction: UomListSortDirection
): UomRow[] {
  return [...rows].sort((a, b) => {
    let primary = 0;
    switch (field) {
      case "code":
        primary = compareStrings(a.code, b.code, direction);
        break;
      case "name":
        primary = compareStrings(a.name, b.name, direction);
        break;
      case "family":
        primary = compareStrings(uomFamilyLabel(a.family), uomFamilyLabel(b.family), direction);
        break;
      case "factor_to_base":
        primary = compareNumbers(a.factor_to_base, b.factor_to_base, direction);
        break;
      case "is_family_base":
        primary = compareNumbers(Number(a.is_family_base), Number(b.is_family_base), direction);
        break;
      case "is_active":
        primary = compareNumbers(Number(a.is_active), Number(b.is_active), direction);
        break;
      case "updated_at":
        primary = compareDates(a.updated_at, b.updated_at, direction);
        break;
    }
    if (primary !== 0) return primary;
    const familyCompare = compareStrings(uomFamilyLabel(a.family), uomFamilyLabel(b.family), "asc");
    if (familyCompare !== 0) return familyCompare;
    return compareStrings(a.code, b.code, "asc");
  });
}

export function isSortableUomColumn(id: string): id is UomListSortField {
  return (
    [
      "code",
      "name",
      "family",
      "factor_to_base",
      "is_family_base",
      "is_active",
      "updated_at",
    ] as const
  ).includes(id as UomListSortField);
}
