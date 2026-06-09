import { purchaseOrderStatusLabel } from "@/lib/procurement/purchase-orders/labels";
import {
  PO_LIST_COLUMN_REGISTRY,
  type PurchaseOrderListColumnId,
} from "@/lib/procurement/purchase-orders/list-columns";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";

export type PurchaseOrderListSortDirection = "asc" | "desc";
export type PurchaseOrderListSortField = PurchaseOrderListColumnId;

export const DEFAULT_PO_SORT_FIELD: PurchaseOrderListSortField = "updated";
export const DEFAULT_PO_SORT_DIRECTION: PurchaseOrderListSortDirection = "desc";

export type PurchaseOrderSortOption = {
  field: PurchaseOrderListSortField;
  direction: PurchaseOrderListSortDirection;
  label: string;
};

export const PO_LIST_SORT_OPTIONS: PurchaseOrderSortOption[] = [
  { field: "po_number", direction: "asc", label: "PO number (A–Z)" },
  { field: "po_number", direction: "desc", label: "PO number (Z–A)" },
  { field: "supplier", direction: "asc", label: "Supplier (A–Z)" },
  { field: "destination", direction: "asc", label: "Destination (A–Z)" },
  { field: "status", direction: "asc", label: "Status (A–Z)" },
  { field: "lines", direction: "desc", label: "Lines (high–low)" },
  { field: "net_amount", direction: "desc", label: "Net amount (high–low)" },
  { field: "created", direction: "desc", label: "Created (newest)" },
  { field: "created", direction: "asc", label: "Created (oldest)" },
  { field: "created_by", direction: "asc", label: "Created by (A–Z)" },
  { field: "updated", direction: "desc", label: "Updated (newest)" },
  { field: "updated", direction: "asc", label: "Updated (oldest)" },
];

export function purchaseOrderSortOptionKey(
  field: PurchaseOrderListSortField,
  direction: PurchaseOrderListSortDirection
): string {
  return `${field}:${direction}`;
}

const DESC_FIRST = new Set<PurchaseOrderListSortField>([
  "lines",
  "net_amount",
  "created",
  "updated",
]);

export function getInitialPurchaseOrderSortDirection(
  field: PurchaseOrderListSortField
): PurchaseOrderListSortDirection {
  return DESC_FIRST.has(field) ? "desc" : "asc";
}

export function togglePurchaseOrderColumnSort(
  field: PurchaseOrderListSortField,
  activeField: PurchaseOrderListSortField,
  activeDirection: PurchaseOrderListSortDirection
): { field: PurchaseOrderListSortField; direction: PurchaseOrderListSortDirection } {
  if (field !== activeField) {
    return { field, direction: getInitialPurchaseOrderSortDirection(field) };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}

function directionMultiplier(direction: PurchaseOrderListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: PurchaseOrderListSortDirection
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
  direction: PurchaseOrderListSortDirection
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
  direction: PurchaseOrderListSortDirection
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

export function sortPurchaseOrderListRows(
  rows: PurchaseOrderRow[],
  field: PurchaseOrderListSortField,
  direction: PurchaseOrderListSortDirection
): PurchaseOrderRow[] {
  return [...rows].sort((a, b) => {
    let primary = 0;
    switch (field) {
      case "po_number":
        primary = compareStrings(a.voucher_number, b.voucher_number, direction);
        break;
      case "supplier":
        primary = compareStrings(a.supplier_name, b.supplier_name, direction);
        break;
      case "destination":
        primary = compareStrings(
          a.destination_location_name,
          b.destination_location_name,
          direction
        );
        break;
      case "status":
        primary = compareStrings(
          purchaseOrderStatusLabel(a.document_status),
          purchaseOrderStatusLabel(b.document_status),
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

export function isSortablePurchaseOrderColumn(id: string): id is PurchaseOrderListSortField {
  return (PO_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(id);
}
