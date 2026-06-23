import { columnWidths } from "@/lib/list-columns/sizing";
import type { ListColumnDef, ListColumnRegistry } from "@/lib/list-columns/types";

export const QC_QUEUE_LIST_COLUMN_IDS = [
  "item",
  "grn_number",
  "purchase_order",
  "location",
  "on_hold",
  "received",
] as const;

export type QcQueueListColumnId = (typeof QC_QUEUE_LIST_COLUMN_IDS)[number];

const W_CODE = columnWidths({ default: { min: 100, max: 160 } });
const W_NAME = columnWidths({ default: { min: 120, max: 220 } });
const W_NUMBER = columnWidths({ default: { min: 72, max: 96 } });
const W_DATE = columnWidths({ default: { min: 100, max: 140 } });

export const QC_QUEUE_LIST_COLUMNS: ListColumnDef<QcQueueListColumnId>[] = [
  {
    id: "item",
    label: "Item",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_NAME,
  },
  {
    id: "grn_number",
    label: "GRN",
    defaultVisible: true,
    group: "Reference",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "purchase_order",
    label: "Purchase order",
    defaultVisible: true,
    group: "Reference",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "location",
    label: "Location",
    defaultVisible: true,
    group: "Route",
    valueKind: "text",
    widths: W_NAME,
  },
  {
    id: "on_hold",
    label: "On hold",
    defaultVisible: true,
    align: "right",
    group: "Details",
    valueKind: "number",
    widths: W_NUMBER,
  },
  {
    id: "received",
    label: "Received",
    defaultVisible: true,
    group: "Timestamps",
    valueKind: "date",
    widths: W_DATE,
  },
];

export const QC_QUEUE_LIST_COLUMN_REGISTRY: ListColumnRegistry<QcQueueListColumnId> = {
  ids: QC_QUEUE_LIST_COLUMN_IDS,
  columns: QC_QUEUE_LIST_COLUMNS,
  storageKey: "aib-qc-queue-list-columns",
};

export function getQcQueueColumnDef(id: QcQueueListColumnId) {
  return QC_QUEUE_LIST_COLUMNS.find((column) => column.id === id)!;
}
