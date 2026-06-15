import {
  QUOTE_LIST_COLUMN_REGISTRY,
  type SalesQuoteListColumnId,
} from "@/lib/sales/quotes/list-columns";
import { salesQuoteStatusLabel } from "@/lib/sales/quotes/labels";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";

export type SalesQuoteListSortDirection = "asc" | "desc";
export type SalesQuoteListSortField = SalesQuoteListColumnId;

export const DEFAULT_QUOTE_SORT_FIELD: SalesQuoteListSortField = "updated";
export const DEFAULT_QUOTE_SORT_DIRECTION: SalesQuoteListSortDirection = "desc";

function directionMultiplier(direction: SalesQuoteListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: SalesQuoteListSortDirection
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
  direction: SalesQuoteListSortDirection
): number {
  const left = Number(a);
  const right = Number(b);
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
  direction: SalesQuoteListSortDirection
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

export function sortSalesQuoteListRows(
  rows: SalesQuoteRow[],
  field: SalesQuoteListSortField,
  direction: SalesQuoteListSortDirection
): SalesQuoteRow[] {
  return [...rows].sort((a, b) => {
    let primary = 0;
    switch (field) {
      case "quote_number":
        primary = compareStrings(a.quotation_number, b.quotation_number, direction);
        break;
      case "customer":
        primary = compareStrings(a.customer_name, b.customer_name, direction);
        break;
      case "origin_location":
        primary = compareStrings(a.origin_location_name, b.origin_location_name, direction);
        break;
      case "status":
        primary = compareStrings(
          salesQuoteStatusLabel(a.commercial_status),
          salesQuoteStatusLabel(b.commercial_status),
          direction
        );
        break;
      case "valid_until":
        primary = compareDates(a.valid_until, b.valid_until, direction);
        break;
      case "converted_order":
        primary = compareStrings(a.converted_to_order_number, b.converted_to_order_number, direction);
        break;
      case "converted_invoice":
        primary = compareStrings(
          a.converted_to_invoice_number,
          b.converted_to_invoice_number,
          direction
        );
        break;
      case "lines":
        primary = compareNumbers(String(a.line_count), String(b.line_count), direction);
        break;
      case "net_amount":
        primary = compareNumbers(a.total_net_amount, b.total_net_amount, direction);
        break;
      case "created":
        primary = compareDates(a.created_at, b.created_at, direction);
        break;
      case "updated":
        primary = compareDates(a.updated_at, b.updated_at, direction);
        break;
    }
    if (primary !== 0) return primary;
    return compareStrings(a.quotation_number, b.quotation_number, "asc");
  });
}

export function isSortableSalesQuoteColumn(id: string): id is SalesQuoteListSortField {
  return (QUOTE_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(id);
}

export function toggleSalesQuoteColumnSort(
  field: SalesQuoteListSortField,
  activeField: SalesQuoteListSortField,
  activeDirection: SalesQuoteListSortDirection
): { field: SalesQuoteListSortField; direction: SalesQuoteListSortDirection } {
  if (field !== activeField) {
    return { field, direction: field === "net_amount" || field === "updated" ? "desc" : "asc" };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}
