import { getEntityColumnDef, type EntityListColumnId } from "@/lib/entities/list-columns";
import type { EntityListRow } from "@/lib/entities/types";

export type EntityListSortDirection = "asc" | "desc";

export type EntityListSortField = Extract<
  EntityListColumnId,
  | "name"
  | "code"
  | "type"
  | "legal_name"
  | "tax_treatment"
  | "tax_registration_number"
  | "primary_contact_name"
  | "primary_contact_email"
  | "company_email"
  | "company_phone"
  | "credit_limit"
  | "current_balance"
  | "payment_terms_days"
  | "is_active"
  | "created_at"
  | "updated_at"
>;

export type EntityListSortOption = {
  field: EntityListSortField;
  direction: EntityListSortDirection;
  label: string;
};

export const DEFAULT_ENTITY_LIST_SORT_FIELD: EntityListSortField = "name";
export const DEFAULT_ENTITY_LIST_SORT_DIRECTION: EntityListSortDirection = "asc";

export const ENTITY_LIST_SORT_OPTIONS: EntityListSortOption[] = [
  { field: "name", direction: "asc", label: "Name (A–Z)" },
  { field: "name", direction: "desc", label: "Name (Z–A)" },
  { field: "code", direction: "asc", label: "Code (A–Z)" },
  { field: "code", direction: "desc", label: "Code (Z–A)" },
  { field: "credit_limit", direction: "desc", label: "Credit limit (high–low)" },
  { field: "credit_limit", direction: "asc", label: "Credit limit (low–high)" },
  { field: "current_balance", direction: "desc", label: "Balance (high–low)" },
  { field: "current_balance", direction: "asc", label: "Balance (low–high)" },
  { field: "payment_terms_days", direction: "desc", label: "Payment terms (long–short)" },
  { field: "payment_terms_days", direction: "asc", label: "Payment terms (short–long)" },
  { field: "updated_at", direction: "desc", label: "Updated (newest)" },
  { field: "updated_at", direction: "asc", label: "Updated (oldest)" },
  { field: "created_at", direction: "desc", label: "Created (newest)" },
  { field: "created_at", direction: "asc", label: "Created (oldest)" },
];

const SORTABLE_FIELDS = new Set<EntityListSortField>([
  "name",
  "code",
  "type",
  "legal_name",
  "tax_treatment",
  "tax_registration_number",
  "primary_contact_name",
  "primary_contact_email",
  "company_email",
  "company_phone",
  "credit_limit",
  "current_balance",
  "payment_terms_days",
  "is_active",
  "created_at",
  "updated_at",
]);

export function sortOptionKey(
  field: EntityListSortField,
  direction: EntityListSortDirection
): string {
  return `${field}:${direction}`;
}

export function isEntityListSortField(value: string): value is EntityListSortField {
  return SORTABLE_FIELDS.has(value as EntityListSortField);
}

export function isSortableEntityColumn(columnId: string): columnId is EntityListSortField {
  return isEntityListSortField(columnId);
}

const DESC_FIRST_SORT_FIELDS = new Set<EntityListSortField>([
  "updated_at",
  "created_at",
  "credit_limit",
  "current_balance",
  "payment_terms_days",
]);

export function getInitialEntitySortDirection(
  field: EntityListSortField
): EntityListSortDirection {
  return DESC_FIRST_SORT_FIELDS.has(field) ? "desc" : "asc";
}

export function toggleEntityColumnSort(
  field: EntityListSortField,
  activeField: EntityListSortField,
  activeDirection: EntityListSortDirection
): { field: EntityListSortField; direction: EntityListSortDirection } {
  if (field !== activeField) {
    return { field, direction: getInitialEntitySortDirection(field) };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}

function directionMultiplier(direction: EntityListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: EntityListSortDirection
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
  direction: EntityListSortDirection
): number {
  return directionMultiplier(direction) * (a - b);
}

function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: EntityListSortDirection
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
  direction: EntityListSortDirection
): number {
  if (a === b) return 0;
  return directionMultiplier(direction) * (a ? 1 : -1);
}

function parseNumericField(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function compareRows(
  a: EntityListRow,
  b: EntityListRow,
  field: EntityListSortField,
  direction: EntityListSortDirection
): number {
  switch (field) {
    case "credit_limit":
    case "current_balance":
      return compareNumbers(
        parseNumericField(a[field]),
        parseNumericField(b[field]),
        direction
      );
    case "payment_terms_days":
      return compareNumbers(a.payment_terms_days, b.payment_terms_days, direction);
    case "created_at":
    case "updated_at":
      return compareDates(a[field], b[field], direction);
    case "is_active":
      return compareBooleans(a[field], b[field], direction);
    default:
      return compareStrings(String(a[field] ?? ""), String(b[field] ?? ""), direction);
  }
}

export function sortEntityListRows(
  rows: EntityListRow[],
  field: EntityListSortField,
  direction: EntityListSortDirection
): EntityListRow[] {
  return [...rows].sort((a, b) => {
    const primary = compareRows(a, b, field, direction);
    if (primary !== 0) return primary;
    return compareStrings(a.name, b.name, "asc");
  });
}

export function getEntitySortFieldLabel(field: EntityListSortField): string {
  return getEntityColumnDef(field).label;
}
