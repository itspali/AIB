import {
  BILL_LIST_COLUMN_REGISTRY,
  type PurchaseBillListColumnId,
} from "@/lib/procurement/bills/list-columns";
import { billMatchStatusLabel } from "@/lib/procurement/bills/three-way-match";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";

export type PurchaseBillListSortDirection = "asc" | "desc";
export type PurchaseBillListSortField = PurchaseBillListColumnId;

export const DEFAULT_BILL_SORT_FIELD: PurchaseBillListSortField = "created";
export const DEFAULT_BILL_SORT_DIRECTION: PurchaseBillListSortDirection = "desc";

export type PurchaseBillSortOption = {
  field: PurchaseBillListSortField;
  direction: PurchaseBillListSortDirection;
  label: string;
};

export const BILL_LIST_SORT_OPTIONS: PurchaseBillSortOption[] = [
  { field: "bill_number", direction: "asc", label: "Bill number (A–Z)" },
  { field: "bill_number", direction: "desc", label: "Bill number (Z–A)" },
  { field: "invoice_number", direction: "asc", label: "Vendor invoice (A–Z)" },
  { field: "supplier", direction: "asc", label: "Supplier (A–Z)" },
  { field: "purchase_order", direction: "asc", label: "Purchase order (A–Z)" },
  { field: "match_status", direction: "asc", label: "Match status (A–Z)" },
  { field: "liability", direction: "desc", label: "Amount due (high–low)" },
  { field: "created", direction: "desc", label: "Created (newest)" },
  { field: "created", direction: "asc", label: "Created (oldest)" },
];

export function purchaseBillSortOptionKey(
  field: PurchaseBillListSortField,
  direction: PurchaseBillListSortDirection
): string {
  return `${field}:${direction}`;
}

const DESC_FIRST = new Set<PurchaseBillListSortField>(["liability", "created"]);

export function getInitialPurchaseBillSortDirection(
  field: PurchaseBillListSortField
): PurchaseBillListSortDirection {
  return DESC_FIRST.has(field) ? "desc" : "asc";
}

export function togglePurchaseBillColumnSort(
  field: PurchaseBillListSortField,
  activeField: PurchaseBillListSortField,
  activeDirection: PurchaseBillListSortDirection
): { field: PurchaseBillListSortField; direction: PurchaseBillListSortDirection } {
  if (field !== activeField) {
    return { field, direction: getInitialPurchaseBillSortDirection(field) };
  }
  return { field, direction: activeDirection === "asc" ? "desc" : "asc" };
}

function directionMultiplier(direction: PurchaseBillListSortDirection): number {
  return direction === "asc" ? 1 : -1;
}

function compareStrings(
  a: string | null | undefined,
  b: string | null | undefined,
  direction: PurchaseBillListSortDirection
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
  direction: PurchaseBillListSortDirection
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
  direction: PurchaseBillListSortDirection
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

function comparePaid(
  a: boolean,
  b: boolean,
  direction: PurchaseBillListSortDirection
): number {
  const left = a ? 1 : 0;
  const right = b ? 1 : 0;
  return directionMultiplier(direction) * (left - right);
}

export function sortPurchaseBillListRows(
  rows: PurchaseBillRow[],
  field: PurchaseBillListSortField,
  direction: PurchaseBillListSortDirection
): PurchaseBillRow[] {
  return [...rows].sort((a, b) => {
    let primary = 0;
    switch (field) {
      case "bill_number":
        primary = compareStrings(a.system_voucher_number, b.system_voucher_number, direction);
        break;
      case "invoice_number":
        primary = compareStrings(a.invoice_number_vendor, b.invoice_number_vendor, direction);
        break;
      case "supplier":
        primary = compareStrings(a.supplier_name, b.supplier_name, direction);
        break;
      case "purchase_order":
        primary = compareStrings(a.purchase_order_number, b.purchase_order_number, direction);
        break;
      case "match_status":
        primary = compareStrings(
          billMatchStatusLabel(a.match_status),
          billMatchStatusLabel(b.match_status),
          direction
        );
        break;
      case "liability":
        primary = compareNumbers(a.total_liability_amount, b.total_liability_amount, direction);
        break;
      case "paid":
        primary = comparePaid(a.is_paid, b.is_paid, direction);
        break;
      case "created":
        primary = compareDates(a.created_at, b.created_at, direction);
        break;
    }
    if (primary !== 0) return primary;
    return compareStrings(a.system_voucher_number, b.system_voucher_number, "asc");
  });
}

export function isSortablePurchaseBillColumn(id: string): id is PurchaseBillListSortField {
  return (BILL_LIST_COLUMN_REGISTRY.ids as readonly string[]).includes(id);
}
