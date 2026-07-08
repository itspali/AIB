import { getCategoryColumnDef, type CategoryListColumnId } from "@/lib/categories/list-columns";
import type { CategoryListRow } from "@/lib/categories/list-row";

export type CategoryListSortDirection = "asc" | "desc";

export type CategoryListSortField = Extract<
  CategoryListColumnId,
  | "name"
  | "parent_name"
  | "is_active"
  | "item_count"
  | "default_item_type"
  | "attribute_count"
  | "inherit_parent_attributes"
  | "created_at"
  | "updated_at"
>;

export type CategoryListSortOption = {
  field: CategoryListSortField;
  direction: CategoryListSortDirection;
  label: string;
};

export const DEFAULT_CATEGORY_LIST_SORT_FIELD: CategoryListSortField = "name";
export const DEFAULT_CATEGORY_LIST_SORT_DIRECTION: CategoryListSortDirection = "asc";

export const CATEGORY_LIST_SORT_OPTIONS: CategoryListSortOption[] = [
  { field: "name", direction: "asc", label: "Name (A–Z)" },
  { field: "name", direction: "desc", label: "Name (Z–A)" },
  { field: "parent_name", direction: "asc", label: "Parent (A–Z)" },
  { field: "parent_name", direction: "desc", label: "Parent (Z–A)" },
  { field: "item_count", direction: "desc", label: "Items (high–low)" },
  { field: "item_count", direction: "asc", label: "Items (low–high)" },
  { field: "updated_at", direction: "desc", label: "Updated (newest)" },
  { field: "updated_at", direction: "asc", label: "Updated (oldest)" },
  { field: "created_at", direction: "desc", label: "Created (newest)" },
  { field: "created_at", direction: "asc", label: "Created (oldest)" },
];

const SORTABLE_FIELDS = new Set<CategoryListSortField>([
  "name",
  "parent_name",
  "is_active",
  "item_count",
  "default_item_type",
  "attribute_count",
  "inherit_parent_attributes",
  "created_at",
  "updated_at",
]);

export function sortOptionKey(
  field: CategoryListSortField,
  direction: CategoryListSortDirection
): string {
  return `${field}:${direction}`;
}

export function isCategoryListSortField(value: string): value is CategoryListSortField {
  return SORTABLE_FIELDS.has(value as CategoryListSortField);
}

export function isSortableCategoryColumn(columnId: string): columnId is CategoryListSortField {
  return isCategoryListSortField(columnId);
}

const DESC_FIRST_SORT_FIELDS = new Set<CategoryListSortField>([
  "updated_at",
  "created_at",
  "item_count",
  "attribute_count",
]);

export function getInitialCategorySortDirection(
  field: CategoryListSortField
): CategoryListSortDirection {
  return DESC_FIRST_SORT_FIELDS.has(field) ? "desc" : "asc";
}

export function toggleCategoryColumnSort(
  field: CategoryListSortField,
  activeField: CategoryListSortField,
  activeDirection: CategoryListSortDirection
): { field: CategoryListSortField; direction: CategoryListSortDirection } {
  if (field !== activeField) {
    return { field, direction: getInitialCategorySortDirection(field) };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}

function directionMultiplier(direction: CategoryListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: CategoryListSortDirection
): number {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return (
    directionMultiplier(direction) *
    left.localeCompare(right, undefined, { sensitivity: "base" })
  );
}

function compareNumbers(
  a: number,
  b: number,
  direction: CategoryListSortDirection
): number {
  return directionMultiplier(direction) * (a - b);
}

function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: CategoryListSortDirection
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

function compareBooleans(
  a: boolean,
  b: boolean,
  direction: CategoryListSortDirection
): number {
  if (a === b) return 0;
  return directionMultiplier(direction) * (a ? 1 : -1);
}

function compareRows(
  a: CategoryListRow,
  b: CategoryListRow,
  field: CategoryListSortField,
  direction: CategoryListSortDirection
): number {
  switch (field) {
    case "item_count":
    case "attribute_count":
      return compareNumbers(a[field], b[field], direction);
    case "created_at":
    case "updated_at":
      return compareDates(a[field], b[field], direction);
    case "is_active":
    case "inherit_parent_attributes":
      return compareBooleans(a[field], b[field], direction);
    default:
      return compareStrings(String(a[field] ?? ""), String(b[field] ?? ""), direction);
  }
}

export function sortCategoryListRows(
  rows: CategoryListRow[],
  field: CategoryListSortField,
  direction: CategoryListSortDirection
): CategoryListRow[] {
  return [...rows].sort((a, b) => {
    const primary = compareRows(a, b, field, direction);
    if (primary !== 0) return primary;
    return compareStrings(a.name, b.name, "asc");
  });
}

export function getCategorySortFieldLabel(field: CategoryListSortField): string {
  return getCategoryColumnDef(field).label;
}
