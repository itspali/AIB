import type {
  QcQueueListSortDirection,
  QcQueueListSortField,
} from "@/lib/procurement/quality-inspection/list-prefs";
import type { QcInspectionQueueRow } from "@/lib/procurement/quality-inspection/types";

export type { QcQueueListSortDirection, QcQueueListSortField };

export type QcQueueSortOption = {
  field: QcQueueListSortField;
  direction: QcQueueListSortDirection;
  label: string;
};

export const QC_QUEUE_LIST_SORT_OPTIONS: QcQueueSortOption[] = [
  { field: "item", direction: "asc", label: "Item (A–Z)" },
  { field: "grn_number", direction: "asc", label: "GRN (A–Z)" },
  { field: "purchase_order", direction: "asc", label: "Purchase order (A–Z)" },
  { field: "location", direction: "asc", label: "Location (A–Z)" },
  { field: "on_hold", direction: "desc", label: "On hold (high–low)" },
  { field: "received", direction: "desc", label: "Received (newest)" },
  { field: "received", direction: "asc", label: "Received (oldest)" },
];

export function qcQueueSortOptionKey(
  field: QcQueueListSortField,
  direction: QcQueueListSortDirection
): string {
  return `${field}:${direction}`;
}

export function isSortableQcQueueColumn(columnId: string): columnId is QcQueueListSortField {
  return (
    columnId === "item" ||
    columnId === "grn_number" ||
    columnId === "purchase_order" ||
    columnId === "location" ||
    columnId === "on_hold" ||
    columnId === "received"
  );
}

export function toggleQcQueueColumnSort(
  currentField: QcQueueListSortField,
  currentDirection: QcQueueListSortDirection,
  nextField: QcQueueListSortField
): { field: QcQueueListSortField; direction: QcQueueListSortDirection } {
  if (currentField !== nextField) {
    return { field: nextField, direction: "asc" };
  }
  return {
    field: nextField,
    direction: currentDirection === "asc" ? "desc" : "asc",
  };
}

function compareStrings(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

function compareNumbers(a: string, b: string): number {
  return Number(a) - Number(b);
}

export function sortQcQueueListRows(
  rows: QcInspectionQueueRow[],
  field: QcQueueListSortField,
  direction: QcQueueListSortDirection
): QcInspectionQueueRow[] {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((left, right) => {
    let result = 0;
    switch (field) {
      case "item":
        result = compareStrings(
          `${left.item_name} ${left.variant_sku}`,
          `${right.item_name} ${right.variant_sku}`
        );
        break;
      case "grn_number":
        result = compareStrings(left.grn_number, right.grn_number);
        break;
      case "purchase_order":
        result = compareStrings(
          left.purchase_order_number ?? "",
          right.purchase_order_number ?? ""
        );
        break;
      case "location":
        result = compareStrings(left.destination_location_name, right.destination_location_name);
        break;
      case "on_hold":
        result = compareNumbers(left.quantity_on_hold, right.quantity_on_hold);
        break;
      case "received":
        result = compareStrings(left.received_at, right.received_at);
        break;
    }
    return result * factor;
  });
}
