import { columnWidths } from "@/lib/list-columns/sizing";
import { CHIP_DEFAULT_FALLBACK_KEY, type ListColumnDef, type ListColumnRegistry } from "@/lib/list-columns/types";
import { stockTransferStatusLabel } from "@/lib/inventory/transfers/labels";
import type { StockTransferStatus } from "@/lib/inventory/transfers/types";

export const TRANSFER_LIST_COLUMN_IDS = [
  "document",
  "from",
  "to",
  "status",
  "lines",
  "created",
] as const;

export type TransferListColumnId = (typeof TRANSFER_LIST_COLUMN_IDS)[number];

const W_LOCATION = columnWidths({ default: { min: 120, max: 200 } });
const W_CODE = columnWidths({ default: { min: 100, max: 160 } });
const W_STATUS = columnWidths({ default: { min: 120, max: 160 } });
const W_NUMBER = columnWidths({ default: { min: 72, max: 96 } });
const W_DATE = columnWidths({ default: { min: 100, max: 140 } });

const TRANSFER_STATUS_CHIP_CATALOG = (
  [
    "DRAFT",
    "DISPATCHED_IN_TRANSIT",
    "FULLY_COMPLETED",
    "RECEIPT_DISCREPANCY",
    "CANCELLED",
  ] as const satisfies readonly StockTransferStatus[]
).map((status) => ({
  value: status,
  label: stockTransferStatusLabel(status),
}));

export const TRANSFER_LIST_COLUMNS: ListColumnDef<TransferListColumnId>[] = [
  {
    id: "document",
    label: "Document",
    defaultVisible: true,
    group: "Identity",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "from",
    label: "From",
    defaultVisible: true,
    group: "Route",
    valueKind: "text",
    widths: W_LOCATION,
  },
  {
    id: "to",
    label: "To",
    defaultVisible: true,
    group: "Route",
    valueKind: "text",
    widths: W_LOCATION,
  },
  {
    id: "status",
    label: "Status",
    defaultVisible: true,
    group: "Status",
    valueKind: "text",
    widths: W_STATUS,
    chipEligible: true,
    chipValueCatalog: TRANSFER_STATUS_CHIP_CATALOG,
    chipDefaultColors: {
      DRAFT: { preset: "slate" },
      DISPATCHED_IN_TRANSIT: { preset: "amber" },
      FULLY_COMPLETED: { preset: "emerald" },
      RECEIPT_DISCREPANCY: { preset: "red" },
      CANCELLED: { preset: "neutral" },
      [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
    },
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
    id: "created",
    label: "Created",
    defaultVisible: true,
    group: "Timestamps",
    valueKind: "date",
    widths: W_DATE,
  },
];

export const TRANSFER_LIST_COLUMN_REGISTRY: ListColumnRegistry<TransferListColumnId> = {
  ids: TRANSFER_LIST_COLUMN_IDS,
  columns: TRANSFER_LIST_COLUMNS,
  storageKey: "aib-transfer-list-columns",
};

export function getTransferColumnDef(id: TransferListColumnId) {
  return TRANSFER_LIST_COLUMNS.find((column) => column.id === id)!;
}
