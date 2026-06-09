import {
  getEntityCategoryColumnDef,
  type EntityCategoryListColumnId,
} from "@/lib/entity-categories/list-columns";
import type { EntityCategoryListRow } from "@/lib/entity-categories/list-row";
import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";

export type EntityCategoryListSortDirection = "asc" | "desc";

export type EntityCategoryListSortField = Extract<
  EntityCategoryListColumnId,
  | "name"
  | "parent_name"
  | "is_active"
  | "entity_count"
  | "attribute_count"
  | "inherit_parent_attributes"
  | "created_at"
  | "updated_at"
>;

export type EntityCategoryListSortOption = {
  field: EntityCategoryListSortField;
  direction: EntityCategoryListSortDirection;
  label: string;
};

export const DEFAULT_ENTITY_CATEGORY_LIST_SORT_FIELD: EntityCategoryListSortField = "name";
export const DEFAULT_ENTITY_CATEGORY_LIST_SORT_DIRECTION: EntityCategoryListSortDirection = "asc";

export function getEntityCategoryListSortOptions(
  workspace: EntityCategoryWorkspace
): EntityCategoryListSortOption[] {
  const entityLabel = getEntityCategoryColumnDef(workspace, "entity_count").label;
  return [
    { field: "name", direction: "asc", label: "Name (A–Z)" },
    { field: "name", direction: "desc", label: "Name (Z–A)" },
    { field: "parent_name", direction: "asc", label: "Parent (A–Z)" },
    { field: "parent_name", direction: "desc", label: "Parent (Z–A)" },
    { field: "entity_count", direction: "desc", label: `${entityLabel} (high–low)` },
    { field: "entity_count", direction: "asc", label: `${entityLabel} (low–high)` },
    { field: "updated_at", direction: "desc", label: "Updated (newest)" },
    { field: "updated_at", direction: "asc", label: "Updated (oldest)" },
    { field: "created_at", direction: "desc", label: "Created (newest)" },
    { field: "created_at", direction: "asc", label: "Created (oldest)" },
  ];
}

const SORTABLE_FIELDS = new Set<EntityCategoryListSortField>([
  "name",
  "parent_name",
  "is_active",
  "entity_count",
  "attribute_count",
  "inherit_parent_attributes",
  "created_at",
  "updated_at",
]);

export function sortOptionKey(
  field: EntityCategoryListSortField,
  direction: EntityCategoryListSortDirection
): string {
  return `${field}:${direction}`;
}

export function isEntityCategoryListSortField(value: string): value is EntityCategoryListSortField {
  return SORTABLE_FIELDS.has(value as EntityCategoryListSortField);
}

export function isSortableEntityCategoryColumn(
  columnId: string
): columnId is EntityCategoryListSortField {
  return isEntityCategoryListSortField(columnId);
}

const DESC_FIRST_SORT_FIELDS = new Set<EntityCategoryListSortField>([
  "updated_at",
  "created_at",
  "entity_count",
  "attribute_count",
]);

export function getInitialEntityCategorySortDirection(
  field: EntityCategoryListSortField
): EntityCategoryListSortDirection {
  return DESC_FIRST_SORT_FIELDS.has(field) ? "desc" : "asc";
}

export function toggleEntityCategoryColumnSort(
  field: EntityCategoryListSortField,
  activeField: EntityCategoryListSortField,
  activeDirection: EntityCategoryListSortDirection
): { field: EntityCategoryListSortField; direction: EntityCategoryListSortDirection } {
  if (field !== activeField) {
    return { field, direction: getInitialEntityCategorySortDirection(field) };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}

function directionMultiplier(direction: EntityCategoryListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: EntityCategoryListSortDirection
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
  direction: EntityCategoryListSortDirection
): number {
  return directionMultiplier(direction) * (a - b);
}

function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: EntityCategoryListSortDirection
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
  direction: EntityCategoryListSortDirection
): number {
  if (a === b) return 0;
  return directionMultiplier(direction) * (a ? 1 : -1);
}

function compareRows(
  a: EntityCategoryListRow,
  b: EntityCategoryListRow,
  field: EntityCategoryListSortField,
  direction: EntityCategoryListSortDirection
): number {
  switch (field) {
    case "entity_count":
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

export function sortEntityCategoryListRows(
  rows: EntityCategoryListRow[],
  field: EntityCategoryListSortField,
  direction: EntityCategoryListSortDirection
): EntityCategoryListRow[] {
  return [...rows].sort((a, b) => {
    const primary = compareRows(a, b, field, direction);
    if (primary !== 0) return primary;
    return compareStrings(a.name, b.name, "asc");
  });
}

export function getEntityCategorySortFieldLabel(
  workspace: EntityCategoryWorkspace,
  field: EntityCategoryListSortField
): string {
  return getEntityCategoryColumnDef(workspace, field).label;
}
