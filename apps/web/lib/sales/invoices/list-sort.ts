import {
  INVOICE_LIST_COLUMN_REGISTRY,
  type SalesInvoiceListColumnId,
} from "@/lib/sales/invoices/list-columns";
import {
  salesInvoicePaymentStatusLabel,
  salesInvoiceStatusLabel,
} from "@/lib/sales/invoices/labels";
import type { SalesInvoiceRow } from "@/lib/sales/invoices/types";

export type SalesInvoiceListSortDirection = "asc" | "desc";
export type SalesInvoiceListSortField = SalesInvoiceListColumnId;

export const DEFAULT_INVOICE_SORT_FIELD: SalesInvoiceListSortField = "updated";
export const DEFAULT_INVOICE_SORT_DIRECTION: SalesInvoiceListSortDirection = "desc";

function directionMultiplier(direction: SalesInvoiceListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: SalesInvoiceListSortDirection
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
  direction: SalesInvoiceListSortDirection
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
  direction: SalesInvoiceListSortDirection
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

export function sortSalesInvoiceListRows(
  rows: SalesInvoiceRow[],
  field: SalesInvoiceListSortField,
  direction: SalesInvoiceListSortDirection
): SalesInvoiceRow[] {
  return [...rows].sort((a, b) => {
    let primary = 0;
    switch (field) {
      case "invoice_number":
        primary = compareStrings(a.invoice_number, b.invoice_number, direction);
        break;
      case "customer":
        primary = compareStrings(a.customer_name, b.customer_name, direction);
        break;
      case "origin_location":
        primary = compareStrings(a.origin_location_name, b.origin_location_name, direction);
        break;
      case "status":
        primary = compareStrings(
          salesInvoiceStatusLabel(a.commercial_status),
          salesInvoiceStatusLabel(b.commercial_status),
          direction
        );
        break;
      case "payment_status":
        primary = compareStrings(
          salesInvoicePaymentStatusLabel(a.invoice_payment_status),
          salesInvoicePaymentStatusLabel(b.invoice_payment_status),
          direction
        );
        break;
      case "source_order":
        primary = compareStrings(a.source_order_number, b.source_order_number, direction);
        break;
      case "net_amount":
        primary = compareNumbers(a.total_net_amount, b.total_net_amount, direction);
        break;
      case "paid_amount":
        primary = compareNumbers(a.total_paid_amount, b.total_paid_amount, direction);
        break;
      case "created":
        primary = compareDates(a.created_at, b.created_at, direction);
        break;
      case "updated":
        primary = compareDates(a.updated_at, b.updated_at, direction);
        break;
    }
    if (primary !== 0) return primary;
    return compareStrings(a.invoice_number, b.invoice_number, "asc");
  });
}

export function isSortableSalesInvoiceColumn(id: string): id is SalesInvoiceListSortField {
  return (INVOICE_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(id);
}

export function toggleSalesInvoiceColumnSort(
  field: SalesInvoiceListSortField,
  activeField: SalesInvoiceListSortField,
  activeDirection: SalesInvoiceListSortDirection
): { field: SalesInvoiceListSortField; direction: SalesInvoiceListSortDirection } {
  if (field !== activeField) {
    return {
      field,
      direction:
        field === "net_amount" || field === "paid_amount" || field === "updated" ? "desc" : "asc",
    };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}
