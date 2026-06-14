import { columnWidths } from "@/lib/list-columns/sizing";
import { CHIP_DEFAULT_FALLBACK_KEY, type ListColumnDef, type ListColumnRegistry } from "@/lib/list-columns/types";
import {
  salesInvoicePaymentStatusLabel,
  salesInvoiceStatusLabel,
} from "@/lib/sales/invoices/labels";
import type { SalesDocumentStatus } from "@/lib/sales/shared/document-status";
import type { SalesPaymentStatus } from "@/lib/sales/orders/types";

export const INVOICE_LIST_COLUMN_IDS = [
  "invoice_number",
  "customer",
  "origin_location",
  "status",
  "payment_status",
  "source_order",
  "net_amount",
  "paid_amount",
  "created",
  "updated",
] as const;

export type SalesInvoiceListColumnId = (typeof INVOICE_LIST_COLUMN_IDS)[number];

const W_CODE = columnWidths({ default: { min: 100, max: 160 } });
const W_NAME = columnWidths({ default: { min: 120, max: 220 } });
const W_STATUS = columnWidths({ default: { min: 120, max: 180 } });
const W_AMOUNT = columnWidths({ default: { min: 96, max: 140 } });
const W_DATE = columnWidths({ default: { min: 100, max: 140 } });

const INVOICE_STATUS_CHIP_CATALOG: Array<{ value: SalesDocumentStatus; label: string }> = (
  ["DRAFT", "PENDING_APPROVAL", "APPROVED_ACTIVE", "CANCELLED"] as SalesDocumentStatus[]
).map((status) => ({
  value: status,
  label: salesInvoiceStatusLabel(status),
}));

const PAYMENT_STATUS_CHIP_CATALOG: Array<{ value: SalesPaymentStatus; label: string }> = (
  ["UNPAID", "PARTIALLY_PAID", "FULLY_PAID", "REFUNDED"] as SalesPaymentStatus[]
).map((status) => ({
  value: status,
  label: salesInvoicePaymentStatusLabel(status),
}));

export const INVOICE_LIST_COLUMNS: ListColumnDef<SalesInvoiceListColumnId>[] = [
  {
    id: "invoice_number",
    label: "Invoice number",
    defaultVisible: true,
    group: "Identity",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "customer",
    label: "Customer",
    defaultVisible: true,
    group: "Parties",
    valueKind: "text",
    widths: W_NAME,
  },
  {
    id: "origin_location",
    label: "Origin",
    defaultVisible: true,
    group: "Route",
    valueKind: "text",
    widths: W_NAME,
  },
  {
    id: "status",
    label: "Status",
    defaultVisible: true,
    group: "Status",
    valueKind: "text",
    widths: W_STATUS,
    chipEligible: true,
    chipValueCatalog: INVOICE_STATUS_CHIP_CATALOG,
    chipDefaultColors: {
      DRAFT: { preset: "slate" },
      PENDING_APPROVAL: { preset: "amber" },
      APPROVED_ACTIVE: { preset: "emerald" },
      CANCELLED: { preset: "neutral" },
      [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
    },
  },
  {
    id: "payment_status",
    label: "Payment",
    defaultVisible: true,
    group: "Status",
    valueKind: "text",
    widths: W_STATUS,
    chipEligible: true,
    chipValueCatalog: PAYMENT_STATUS_CHIP_CATALOG,
    chipDefaultColors: {
      UNPAID: { preset: "amber" },
      PARTIALLY_PAID: { preset: "sky" },
      FULLY_PAID: { preset: "emerald" },
      REFUNDED: { preset: "neutral" },
      [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
    },
  },
  {
    id: "source_order",
    label: "Sales order",
    defaultVisible: true,
    group: "Reference",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "net_amount",
    label: "Net amount",
    defaultVisible: true,
    align: "right",
    group: "Details",
    valueKind: "number",
    widths: W_AMOUNT,
  },
  {
    id: "paid_amount",
    label: "Paid",
    defaultVisible: true,
    align: "right",
    group: "Details",
    valueKind: "number",
    widths: W_AMOUNT,
  },
  {
    id: "created",
    label: "Created",
    defaultVisible: false,
    group: "Timestamps",
    valueKind: "date",
    widths: W_DATE,
  },
  {
    id: "updated",
    label: "Updated",
    defaultVisible: true,
    group: "Timestamps",
    valueKind: "date",
    widths: W_DATE,
  },
];

export const INVOICE_LIST_COLUMN_REGISTRY: ListColumnRegistry<SalesInvoiceListColumnId> = {
  ids: INVOICE_LIST_COLUMN_IDS,
  columns: INVOICE_LIST_COLUMNS,
  storageKey: "aib-invoice-list-columns",
};

export function getSalesInvoiceColumnDef(id: SalesInvoiceListColumnId) {
  return INVOICE_LIST_COLUMNS.find((column) => column.id === id)!;
}
