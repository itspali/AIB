import { columnWidths } from "@/lib/list-columns/sizing";
import { CHIP_DEFAULT_FALLBACK_KEY, type ListColumnDef, type ListColumnRegistry } from "@/lib/list-columns/types";
import { salesQuoteStatusLabel } from "@/lib/sales/quotes/labels";
import type { SalesDocumentStatus } from "@/lib/sales/shared/document-status";

export const QUOTE_LIST_COLUMN_IDS = [
  "quote_number",
  "customer",
  "origin_location",
  "status",
  "valid_until",
  "lines",
  "net_amount",
  "created",
  "updated",
] as const;

export type SalesQuoteListColumnId = (typeof QUOTE_LIST_COLUMN_IDS)[number];

const W_CODE = columnWidths({ default: { min: 100, max: 160 } });
const W_NAME = columnWidths({ default: { min: 120, max: 220 } });
const W_STATUS = columnWidths({ default: { min: 120, max: 180 } });
const W_NUMBER = columnWidths({ default: { min: 72, max: 96 } });
const W_AMOUNT = columnWidths({ default: { min: 96, max: 140 } });
const W_DATE = columnWidths({ default: { min: 100, max: 140 } });

const QUOTE_STATUS_CHIP_CATALOG: Array<{ value: SalesDocumentStatus; label: string }> = (
  ["DRAFT", "PENDING_APPROVAL", "APPROVED_ACTIVE", "CANCELLED"] as SalesDocumentStatus[]
).map((status) => ({
  value: status,
  label: salesQuoteStatusLabel(status),
}));

export const QUOTE_LIST_COLUMNS: ListColumnDef<SalesQuoteListColumnId>[] = [
  {
    id: "quote_number",
    label: "Quote number",
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
    chipValueCatalog: QUOTE_STATUS_CHIP_CATALOG,
    chipDefaultColors: {
      DRAFT: { preset: "slate" },
      PENDING_APPROVAL: { preset: "amber" },
      APPROVED_ACTIVE: { preset: "emerald" },
      CANCELLED: { preset: "neutral" },
      [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
    },
  },
  {
    id: "valid_until",
    label: "Valid until",
    defaultVisible: true,
    group: "Timestamps",
    valueKind: "date",
    widths: W_DATE,
  },
  {
    id: "lines",
    label: "Lines",
    defaultVisible: true,
    align: "right",
    group: "Details",
    valueKind: "number",
    widths: W_NUMBER,
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

export const QUOTE_LIST_COLUMN_REGISTRY: ListColumnRegistry<SalesQuoteListColumnId> = {
  ids: QUOTE_LIST_COLUMN_IDS,
  columns: QUOTE_LIST_COLUMNS,
  storageKey: "aib-quote-list-columns",
};

export function getSalesQuoteColumnDef(id: SalesQuoteListColumnId) {
  return QUOTE_LIST_COLUMNS.find((column) => column.id === id)!;
}
