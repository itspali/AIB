import { classificationLabel } from "@/lib/products/classification-labels";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import type { ProductListRow } from "@/lib/products/types";

export type ProductListSortDirection = "asc" | "desc";

/** Fields that support client-side list sorting. */
export type ProductListSortField = Extract<
  ProductListColumnId,
  | "name"
  | "default_sku"
  | "barcode"
  | "classification"
  | "category_name"
  | "base_unit_of_measure"
  | "hsn_sac_code"
  | "default_tax_category"
  | "supplier_name"
  | "selling_price"
  | "purchase_price"
  | "created_at"
  | "updated_at"
  | "is_active"
  | "is_purchasable"
  | "is_salable"
  | "is_returnable"
  | "has_variants"
>;

export type ProductListSortOption = {
  field: ProductListSortField;
  direction: ProductListSortDirection;
  label: string;
};

export const DEFAULT_PRODUCT_LIST_SORT_FIELD: ProductListSortField = "name";
export const DEFAULT_PRODUCT_LIST_SORT_DIRECTION: ProductListSortDirection = "asc";

export const PRODUCT_LIST_SORT_OPTIONS: ProductListSortOption[] = [
  { field: "name", direction: "asc", label: "Name (A–Z)" },
  { field: "name", direction: "desc", label: "Name (Z–A)" },
  { field: "default_sku", direction: "asc", label: "SKU (A–Z)" },
  { field: "default_sku", direction: "desc", label: "SKU (Z–A)" },
  { field: "category_name", direction: "asc", label: "Category (A–Z)" },
  { field: "category_name", direction: "desc", label: "Category (Z–A)" },
  { field: "classification", direction: "asc", label: "Classification (A–Z)" },
  { field: "updated_at", direction: "desc", label: "Updated (newest)" },
  { field: "updated_at", direction: "asc", label: "Updated (oldest)" },
  { field: "created_at", direction: "desc", label: "Created (newest)" },
  { field: "created_at", direction: "asc", label: "Created (oldest)" },
  { field: "selling_price", direction: "asc", label: "Selling price (low–high)" },
  { field: "selling_price", direction: "desc", label: "Selling price (high–low)" },
  { field: "purchase_price", direction: "asc", label: "Purchase price (low–high)" },
  { field: "purchase_price", direction: "desc", label: "Purchase price (high–low)" },
];

const ALL_SORTABLE_FIELDS: ProductListSortField[] = [
  "name",
  "default_sku",
  "barcode",
  "classification",
  "category_name",
  "base_unit_of_measure",
  "hsn_sac_code",
  "default_tax_category",
  "supplier_name",
  "selling_price",
  "purchase_price",
  "created_at",
  "updated_at",
  "is_active",
  "is_purchasable",
  "is_salable",
  "is_returnable",
  "has_variants",
];

const SORTABLE_FIELDS = new Set<ProductListSortField>(ALL_SORTABLE_FIELDS);

export function sortOptionKey(field: ProductListSortField, direction: ProductListSortDirection): string {
  return `${field}:${direction}`;
}

export function parseSortOptionKey(value: string): {
  field: ProductListSortField;
  direction: ProductListSortDirection;
} | null {
  const [field, direction] = value.split(":");
  if (!field || (direction !== "asc" && direction !== "desc")) return null;
  if (!SORTABLE_FIELDS.has(field as ProductListSortField)) return null;
  return { field: field as ProductListSortField, direction };
}

export function isProductListSortField(value: string): value is ProductListSortField {
  return SORTABLE_FIELDS.has(value as ProductListSortField);
}

export function isSortableColumn(columnId: string): columnId is ProductListSortField {
  return isProductListSortField(columnId);
}

const DESC_FIRST_SORT_FIELDS = new Set<ProductListSortField>([
  "updated_at",
  "created_at",
  "selling_price",
  "purchase_price",
]);

export function getInitialSortDirection(field: ProductListSortField): ProductListSortDirection {
  return DESC_FIRST_SORT_FIELDS.has(field) ? "desc" : "asc";
}

export function toggleColumnSort(
  field: ProductListSortField,
  activeField: ProductListSortField,
  activeDirection: ProductListSortDirection
): { field: ProductListSortField; direction: ProductListSortDirection } {
  if (field !== activeField) {
    return { field, direction: getInitialSortDirection(field) };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}

function directionMultiplier(direction: ProductListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: ProductListSortDirection
): number {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return directionMultiplier(direction) * left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareNumbers(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: ProductListSortDirection
): number {
  const left = a?.trim() ? Number(a) : null;
  const right = b?.trim() ? Number(b) : null;
  const leftValid = left !== null && Number.isFinite(left);
  const rightValid = right !== null && Number.isFinite(right);
  if (!leftValid && !rightValid) return 0;
  if (!leftValid) return 1;
  if (!rightValid) return -1;
  return directionMultiplier(direction) * (left - right);
}

function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: ProductListSortDirection
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

function compareBooleans(a: boolean, b: boolean, direction: ProductListSortDirection): number {
  if (a === b) return 0;
  const cmp = a ? 1 : -1;
  return directionMultiplier(direction) * cmp;
}

function getSortValue(row: ProductListRow, field: ProductListSortField): string | boolean {
  switch (field) {
    case "classification":
      return classificationLabel(row.classification);
    case "default_tax_category":
      return taxCategoryLabel(row.default_tax_category);
    case "is_active":
      return row.is_active;
    case "is_purchasable":
      return row.is_purchasable;
    case "is_salable":
      return row.is_salable;
    case "is_returnable":
      return row.is_returnable;
    case "has_variants":
      return row.has_variants;
    default:
      return row[field] ?? "";
  }
}

function compareRows(
  a: ProductListRow,
  b: ProductListRow,
  field: ProductListSortField,
  direction: ProductListSortDirection
): number {
  switch (field) {
    case "selling_price":
    case "purchase_price":
      return compareNumbers(a[field], b[field], direction);
    case "created_at":
    case "updated_at":
      return compareDates(a[field], b[field], direction);
    case "is_active":
    case "is_purchasable":
    case "is_salable":
    case "is_returnable":
    case "has_variants":
      return compareBooleans(a[field], b[field], direction);
    default: {
      const left = getSortValue(a, field);
      const right = getSortValue(b, field);
      return compareStrings(
        typeof left === "string" ? left : String(left),
        typeof right === "string" ? right : String(right),
        direction
      );
    }
  }
}

export function sortProductListRows(
  rows: ProductListRow[],
  field: ProductListSortField,
  direction: ProductListSortDirection
): ProductListRow[] {
  return [...rows].sort((a, b) => {
    const primary = compareRows(a, b, field, direction);
    if (primary !== 0) return primary;
    return compareStrings(a.name, b.name, "asc");
  });
}

export function getSortFieldLabel(field: ProductListSortField): string {
  return getColumnDef(field).label;
}
