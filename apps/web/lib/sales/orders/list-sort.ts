import { salesOrderStatusLabel } from "@/lib/sales/orders/labels";
import {
  SO_LIST_COLUMN_REGISTRY,
  type SalesOrderListColumnId,
} from "@/lib/sales/orders/list-columns";
import type { SalesOrderRow } from "@/lib/sales/orders/types";

export type SalesOrderListSortDirection = "asc" | "desc";
export type SalesOrderListSortField = SalesOrderListColumnId;

export const DEFAULT_SO_SORT_FIELD: SalesOrderListSortField = "updated";
export const DEFAULT_SO_SORT_DIRECTION: SalesOrderListSortDirection = "desc";

export type SalesOrderSortOption = {
  field: SalesOrderListSortField;
  direction: SalesOrderListSortDirection;
  label: string;
};

export const SO_LIST_SORT_OPTIONS: SalesOrderSortOption[] = [
  { field: "so_number", direction: "asc", label: "SO number (A–Z)" },
  { field: "so_number", direction: "desc", label: "SO number (Z–A)" },
  { field: "customer", direction: "asc", label: "Customer (A–Z)" },
  { field: "shipping_location", direction: "asc", label: "Ship from (A–Z)" },
  { field: "status", direction: "asc", label: "Status (A–Z)" },
  { field: "lines", direction: "desc", label: "Lines (high–low)" },
  { field: "net_amount", direction: "desc", label: "Net amount (high–low)" },
  { field: "created", direction: "desc", label: "Created (newest)" },
  { field: "created", direction: "asc", label: "Created (oldest)" },
  { field: "created_by", direction: "asc", label: "Created by (A–Z)" },
  { field: "updated", direction: "desc", label: "Updated (newest)" },
  { field: "updated", direction: "asc", label: "Updated (oldest)" },
];

export function salesOrderSortOptionKey(
  field: SalesOrderListSortField,
  direction: SalesOrderListSortDirection
): string {
  return `${field}:${direction}`;
}

const DESC_FIRST = new Set<SalesOrderListSortField>([
  "lines",
  "net_amount",
  "created",
  "updated",
]);

export function getInitialSalesOrderSortDirection(
  field: SalesOrderListSortField
): SalesOrderListSortDirection {
  return DESC_FIRST.has(field) ? "desc" : "asc";
}

export function toggleSalesOrderColumnSort(
  field: SalesOrderListSortField,
  activeField: SalesOrderListSortField,
  activeDirection: SalesOrderListSortDirection
): { field: SalesOrderListSortField; direction: SalesOrderListSortDirection } {
  if (field !== activeField) {
    return { field, direction: getInitialSalesOrderSortDirection(field) };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}

function directionMultiplier(direction: SalesOrderListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: SalesOrderListSortDirection
): number {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return directionMultiplier(direction) * left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: SalesOrderListSortDirection
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

function compareAmounts(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: SalesOrderListSortDirection
): number {
  const left = a != null ? Number.parseFloat(a) : Number.NaN;
  const right = b != null ? Number.parseFloat(b) : Number.NaN;
  const leftValid = Number.isFinite(left);
  const rightValid = Number.isFinite(right);
  if (!leftValid && !rightValid) return 0;
  if (!leftValid) return 1;
  if (!rightValid) return -1;
  return directionMultiplier(direction) * (left - right);
}

export function sortSalesOrderListRows(
  rows: SalesOrderRow[],
  field: SalesOrderListSortField,
  direction: SalesOrderListSortDirection
): SalesOrderRow[] {
  return [...rows].sort((a, b) => {
    let primary = 0;
    switch (field) {
      case "so_number":
        primary = compareStrings(a.voucher_number, b.voucher_number, direction);
        break;
      case "customer":
        primary = compareStrings(a.customer_name, b.customer_name, direction);
        break;
      case "shipping_location":
        primary = compareStrings(a.shipping_location_name, b.shipping_location_name, direction);
        break;
      case "status":
        primary = compareStrings(
          salesOrderStatusLabel(a.commercial_status),
          salesOrderStatusLabel(b.commercial_status),
          direction
        );
        break;
      case "lines":
        primary = directionMultiplier(direction) * (a.line_count - b.line_count);
        break;
      case "net_amount":
        primary = compareAmounts(a.total_net_amount, b.total_net_amount, direction);
        break;
      case "created":
        primary = compareDates(a.created_at, b.created_at, direction);
        break;
      case "created_by":
        primary = compareStrings(a.created_by_name, b.created_by_name, direction);
        break;
      case "updated":
        primary = compareDates(a.updated_at, b.updated_at, direction);
        break;
    }
    if (primary !== 0) return primary;
    return compareStrings(a.voucher_number, b.voucher_number, "asc");
  });
}

export function isSortableSalesOrderColumn(id: string): id is SalesOrderListSortField {
  return (SO_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(id);
}
