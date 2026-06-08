import type { StockAdjustmentRow, StockBalanceRow } from "@/lib/inventory/stock/types";
import type {
  StockAdjustmentColumnId,
  StockBalanceColumnId,
} from "@/lib/inventory/stock/list-columns";
import { stockAdjustmentKindLabel } from "@/lib/inventory/stock/labels";

export type StockListSortDirection = "asc" | "desc";

export type StockBalanceSortField = StockBalanceColumnId;
export type StockAdjustmentSortField = StockAdjustmentColumnId;

export const DEFAULT_STOCK_BALANCE_SORT_FIELD: StockBalanceSortField = "location";
export const DEFAULT_STOCK_BALANCE_SORT_DIRECTION: StockListSortDirection = "asc";
export const DEFAULT_STOCK_ADJUSTMENT_SORT_FIELD: StockAdjustmentSortField = "posted";
export const DEFAULT_STOCK_ADJUSTMENT_SORT_DIRECTION: StockListSortDirection = "desc";

export type StockSortOption = {
  field: StockBalanceSortField | StockAdjustmentSortField;
  direction: StockListSortDirection;
  label: string;
};

export const STOCK_BALANCE_SORT_OPTIONS: StockSortOption[] = [
  { field: "location", direction: "asc", label: "Location (A–Z)" },
  { field: "location", direction: "desc", label: "Location (Z–A)" },
  { field: "item", direction: "asc", label: "Item (A–Z)" },
  { field: "item", direction: "desc", label: "Item (Z–A)" },
  { field: "sku", direction: "asc", label: "SKU (A–Z)" },
  { field: "on_hand", direction: "desc", label: "On hand (high–low)" },
  { field: "on_hand", direction: "asc", label: "On hand (low–high)" },
  { field: "avg_cost", direction: "desc", label: "Avg cost (high–low)" },
  { field: "reorder", direction: "desc", label: "Reorder (high–low)" },
];

export const STOCK_ADJUSTMENT_SORT_OPTIONS: StockSortOption[] = [
  { field: "document", direction: "asc", label: "Document (A–Z)" },
  { field: "document", direction: "desc", label: "Document (Z–A)" },
  { field: "location", direction: "asc", label: "Location (A–Z)" },
  { field: "kind", direction: "asc", label: "Kind (A–Z)" },
  { field: "posted", direction: "desc", label: "Posted (newest)" },
  { field: "posted", direction: "asc", label: "Posted (oldest)" },
  { field: "lines", direction: "desc", label: "Lines (high–low)" },
];

export function stockSortOptionKey(field: string, direction: StockListSortDirection): string {
  return `${field}:${direction}`;
}

const DESC_FIRST = new Set<string>(["on_hand", "avg_cost", "reorder", "lines", "posted"]);

export function getInitialStockSortDirection(field: string): StockListSortDirection {
  return DESC_FIRST.has(field) ? "desc" : "asc";
}

export function toggleStockColumnSort<TField extends string>(
  field: TField,
  activeField: TField,
  activeDirection: StockListSortDirection
): { field: TField; direction: StockListSortDirection } {
  if (field !== activeField) {
    return { field, direction: getInitialStockSortDirection(field) };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}

function directionMultiplier(direction: StockListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: StockListSortDirection
): number {
  const left = a?.trim() ?? "";
  const right = b?.trim() ?? "";
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return directionMultiplier(direction) * left.localeCompare(right, undefined, { sensitivity: "base" });
}

function compareNumbersFromString(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: StockListSortDirection
): number {
  const left = Number.parseFloat(a ?? "");
  const right = Number.parseFloat(b ?? "");
  const leftValid = Number.isFinite(left);
  const rightValid = Number.isFinite(right);
  if (!leftValid && !rightValid) return 0;
  if (!leftValid) return 1;
  if (!rightValid) return -1;
  return directionMultiplier(direction) * (left - right);
}

function compareDates(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: StockListSortDirection
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

export function sortStockBalanceRows(
  rows: StockBalanceRow[],
  field: StockBalanceSortField,
  direction: StockListSortDirection
): StockBalanceRow[] {
  return [...rows].sort((a, b) => {
    let primary = 0;
    switch (field) {
      case "location":
        primary = compareStrings(a.location_name, b.location_name, direction);
        break;
      case "item":
        primary = compareStrings(a.item_name, b.item_name, direction);
        break;
      case "sku":
        primary = compareStrings(a.variant_sku, b.variant_sku, direction);
        break;
      case "on_hand":
        primary = compareNumbersFromString(a.total_quantity_on_hand, b.total_quantity_on_hand, direction);
        break;
      case "avg_cost":
        primary = compareNumbersFromString(a.current_average_cost, b.current_average_cost, direction);
        break;
      case "reorder":
        primary = compareNumbersFromString(a.reorder_point, b.reorder_point, direction);
        break;
    }
    if (primary !== 0) return primary;
    return compareStrings(a.variant_sku, b.variant_sku, "asc");
  });
}

export function sortStockAdjustmentRows(
  rows: StockAdjustmentRow[],
  field: StockAdjustmentSortField,
  direction: StockListSortDirection
): StockAdjustmentRow[] {
  return [...rows].sort((a, b) => {
    let primary = 0;
    switch (field) {
      case "document":
        primary = compareStrings(a.adjustment_number, b.adjustment_number, direction);
        break;
      case "location":
        primary = compareStrings(a.location_name, b.location_name, direction);
        break;
      case "kind":
        primary = compareStrings(
          stockAdjustmentKindLabel(a.kind),
          stockAdjustmentKindLabel(b.kind),
          direction
        );
        break;
      case "reason":
        primary = compareStrings(a.reason, b.reason, direction);
        break;
      case "lines":
        primary = directionMultiplier(direction) * (a.line_count - b.line_count);
        break;
      case "posted":
        primary = compareDates(a.posted_at, b.posted_at, direction);
        break;
    }
    if (primary !== 0) return primary;
    return compareStrings(a.adjustment_number, b.adjustment_number, "asc");
  });
}

export function isSortableStockBalanceColumn(id: string): id is StockBalanceSortField {
  return (["location", "item", "sku", "on_hand", "avg_cost", "reorder"] as const).includes(
    id as StockBalanceSortField
  );
}

export function isSortableStockAdjustmentColumn(id: string): id is StockAdjustmentSortField {
  return (
    ["document", "location", "kind", "reason", "lines", "posted"] as const
  ).includes(id as StockAdjustmentSortField);
}
