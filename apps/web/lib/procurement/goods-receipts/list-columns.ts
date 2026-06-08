import { columnWidths } from "@/lib/list-columns/sizing";
import type { ListColumnDef, ListColumnRegistry } from "@/lib/list-columns/types";

export const GRN_LIST_COLUMN_IDS = [
  "grn_number",
  "location",
  "purchase_order",
  "lines",
  "received",
] as const;

export type GoodsReceiptListColumnId = (typeof GRN_LIST_COLUMN_IDS)[number];

const W_CODE = columnWidths({ default: { min: 100, max: 160 } });
const W_NAME = columnWidths({ default: { min: 120, max: 220 } });
const W_NUMBER = columnWidths({ default: { min: 72, max: 96 } });
const W_DATE = columnWidths({ default: { min: 100, max: 140 } });

export const GRN_LIST_COLUMNS: ListColumnDef<GoodsReceiptListColumnId>[] = [
  {
    id: "grn_number",
    label: "GRN number",
    defaultVisible: true,
    group: "Identity",
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
    id: "purchase_order",
    label: "Purchase order",
    defaultVisible: true,
    group: "Reference",
    valueKind: "code",
    widths: W_CODE,
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
    id: "received",
    label: "Received",
    defaultVisible: true,
    group: "Timestamps",
    valueKind: "date",
    widths: W_DATE,
  },
];

export const GRN_LIST_COLUMN_REGISTRY: ListColumnRegistry<GoodsReceiptListColumnId> = {
  ids: GRN_LIST_COLUMN_IDS,
  columns: GRN_LIST_COLUMNS,
  storageKey: "aib-grn-list-columns",
};

export function getGoodsReceiptColumnDef(id: GoodsReceiptListColumnId) {
  return GRN_LIST_COLUMNS.find((column) => column.id === id)!;
}
