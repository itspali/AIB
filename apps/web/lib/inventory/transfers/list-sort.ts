import { stockTransferStatusLabel } from "@/lib/inventory/transfers/labels";
import {
  TRANSFER_LIST_COLUMN_REGISTRY,
  type TransferListColumnId,
} from "@/lib/inventory/transfers/list-columns";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";

export type TransferListSortDirection = "asc" | "desc";
export type TransferListSortField = TransferListColumnId;

export const DEFAULT_TRANSFER_SORT_FIELD: TransferListSortField = "created";
export const DEFAULT_TRANSFER_SORT_DIRECTION: TransferListSortDirection = "desc";

export type TransferSortOption = {
  field: TransferListSortField;
  direction: TransferListSortDirection;
  label: string;
};

export const TRANSFER_LIST_SORT_OPTIONS: TransferSortOption[] = [
  { field: "document", direction: "asc", label: "Document (A–Z)" },
  { field: "document", direction: "desc", label: "Document (Z–A)" },
  { field: "from", direction: "asc", label: "From (A–Z)" },
  { field: "to", direction: "asc", label: "To (A–Z)" },
  { field: "status", direction: "asc", label: "Status (A–Z)" },
  { field: "lines", direction: "desc", label: "Lines (high–low)" },
  { field: "created", direction: "desc", label: "Created (newest)" },
  { field: "created", direction: "asc", label: "Created (oldest)" },
];

export function transferSortOptionKey(
  field: TransferListSortField,
  direction: TransferListSortDirection
): string {
  return `${field}:${direction}`;
}

const DESC_FIRST = new Set<TransferListSortField>(["lines", "created"]);

export function getInitialTransferSortDirection(
  field: TransferListSortField
): TransferListSortDirection {
  return DESC_FIRST.has(field) ? "desc" : "asc";
}

export function toggleTransferColumnSort(
  field: TransferListSortField,
  activeField: TransferListSortField,
  activeDirection: TransferListSortDirection
): { field: TransferListSortField; direction: TransferListSortDirection } {
  if (field !== activeField) {
    return { field, direction: getInitialTransferSortDirection(field) };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}

function directionMultiplier(direction: TransferListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: TransferListSortDirection
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
  direction: TransferListSortDirection
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

export function sortTransferListRows(
  rows: StockTransferRow[],
  field: TransferListSortField,
  direction: TransferListSortDirection
): StockTransferRow[] {
  return [...rows].sort((a, b) => {
    let primary = 0;
    switch (field) {
      case "document":
        primary = compareStrings(a.transfer_number, b.transfer_number, direction);
        break;
      case "from":
        primary = compareStrings(a.source_location_name, b.source_location_name, direction);
        break;
      case "to":
        primary = compareStrings(a.destination_location_name, b.destination_location_name, direction);
        break;
      case "status":
        primary = compareStrings(
          stockTransferStatusLabel(a.current_status),
          stockTransferStatusLabel(b.current_status),
          direction
        );
        break;
      case "lines":
        primary = directionMultiplier(direction) * (a.line_count - b.line_count);
        break;
      case "created":
        primary = compareDates(
          a.dispatched_at ?? a.created_at,
          b.dispatched_at ?? b.created_at,
          direction
        );
        break;
    }
    if (primary !== 0) return primary;
    return compareStrings(a.transfer_number, b.transfer_number, "asc");
  });
}

export function isSortableTransferColumn(id: string): id is TransferListSortField {
  return (TRANSFER_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(id);
}
