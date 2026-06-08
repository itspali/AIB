import {
  GRN_LIST_COLUMN_REGISTRY,
  type GoodsReceiptListColumnId,
} from "@/lib/procurement/goods-receipts/list-columns";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";

export type GoodsReceiptListSortDirection = "asc" | "desc";
export type GoodsReceiptListSortField = GoodsReceiptListColumnId;

export const DEFAULT_GRN_SORT_FIELD: GoodsReceiptListSortField = "received";
export const DEFAULT_GRN_SORT_DIRECTION: GoodsReceiptListSortDirection = "desc";

export type GoodsReceiptSortOption = {
  field: GoodsReceiptListSortField;
  direction: GoodsReceiptListSortDirection;
  label: string;
};

export const GRN_LIST_SORT_OPTIONS: GoodsReceiptSortOption[] = [
  { field: "grn_number", direction: "asc", label: "GRN number (A–Z)" },
  { field: "grn_number", direction: "desc", label: "GRN number (Z–A)" },
  { field: "location", direction: "asc", label: "Location (A–Z)" },
  { field: "purchase_order", direction: "asc", label: "Purchase order (A–Z)" },
  { field: "lines", direction: "desc", label: "Lines (high–low)" },
  { field: "received", direction: "desc", label: "Received (newest)" },
  { field: "received", direction: "asc", label: "Received (oldest)" },
];

export function goodsReceiptSortOptionKey(
  field: GoodsReceiptListSortField,
  direction: GoodsReceiptListSortDirection
): string {
  return `${field}:${direction}`;
}

const DESC_FIRST = new Set<GoodsReceiptListSortField>(["lines", "received"]);

export function getInitialGoodsReceiptSortDirection(
  field: GoodsReceiptListSortField
): GoodsReceiptListSortDirection {
  return DESC_FIRST.has(field) ? "desc" : "asc";
}

export function toggleGoodsReceiptColumnSort(
  field: GoodsReceiptListSortField,
  activeField: GoodsReceiptListSortField,
  activeDirection: GoodsReceiptListSortDirection
): { field: GoodsReceiptListSortField; direction: GoodsReceiptListSortDirection } {
  if (field !== activeField) {
    return { field, direction: getInitialGoodsReceiptSortDirection(field) };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}

function directionMultiplier(direction: GoodsReceiptListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: GoodsReceiptListSortDirection
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
  direction: GoodsReceiptListSortDirection
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

export function sortGoodsReceiptListRows(
  rows: GoodsReceiptRow[],
  field: GoodsReceiptListSortField,
  direction: GoodsReceiptListSortDirection
): GoodsReceiptRow[] {
  return [...rows].sort((a, b) => {
    let primary = 0;
    switch (field) {
      case "grn_number":
        primary = compareStrings(a.voucher_number, b.voucher_number, direction);
        break;
      case "location":
        primary = compareStrings(a.destination_location_name, b.destination_location_name, direction);
        break;
      case "purchase_order":
        primary = compareStrings(a.purchase_order_number, b.purchase_order_number, direction);
        break;
      case "lines":
        primary = directionMultiplier(direction) * (a.line_count - b.line_count);
        break;
      case "received":
        primary = compareDates(a.received_at, b.received_at, direction);
        break;
    }
    if (primary !== 0) return primary;
    return compareStrings(a.voucher_number, b.voucher_number, "asc");
  });
}

export function isSortableGoodsReceiptColumn(id: string): id is GoodsReceiptListSortField {
  return (GRN_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(id);
}
