import { columnWidths } from "@/lib/list-columns/sizing";
import { CHIP_DEFAULT_FALLBACK_KEY, type ListColumnDef, type ListColumnRegistry } from "@/lib/list-columns/types";
import { purchaseOrderStatusLabel } from "@/lib/procurement/purchase-orders/labels";
import type { PurchaseOrderStatus } from "@/lib/procurement/purchase-orders/types";

export const PO_LIST_COLUMN_IDS = [
  "po_number",
  "supplier",
  "destination",
  "status",
  "lines",
  "net_amount",
  "updated",
] as const;

export type PurchaseOrderListColumnId = (typeof PO_LIST_COLUMN_IDS)[number];

const W_CODE = columnWidths({ default: { min: 100, max: 160 } });
const W_NAME = columnWidths({ default: { min: 120, max: 220 } });
const W_STATUS = columnWidths({ default: { min: 120, max: 180 } });
const W_NUMBER = columnWidths({ default: { min: 72, max: 96 } });
const W_AMOUNT = columnWidths({ default: { min: 96, max: 140 } });
const W_DATE = columnWidths({ default: { min: 100, max: 140 } });

const PO_STATUS_CHIP_CATALOG: Array<{ value: PurchaseOrderStatus; label: string }> = (
  [
    "DRAFT",
    "PENDING_APPROVAL",
    "ISSUED_ACTIVE",
    "QC_HOLD",
    "PARTIALLY_FULFILLED",
    "FULLY_COMPLETED",
    "CANCELLED",
  ] as PurchaseOrderStatus[]
).map((status) => ({
  value: status,
  label: purchaseOrderStatusLabel(status),
}));

export const PO_LIST_COLUMNS: ListColumnDef<PurchaseOrderListColumnId>[] = [
  {
    id: "po_number",
    label: "PO number",
    defaultVisible: true,
    group: "Identity",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "supplier",
    label: "Supplier",
    defaultVisible: true,
    group: "Parties",
    valueKind: "text",
    widths: W_NAME,
  },
  {
    id: "destination",
    label: "Destination",
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
    chipValueCatalog: PO_STATUS_CHIP_CATALOG,
    chipDefaultColors: {
      DRAFT: { preset: "slate" },
      PENDING_APPROVAL: { preset: "amber" },
      ISSUED_ACTIVE: { preset: "indigo" },
      QC_HOLD: { preset: "amber" },
      PARTIALLY_FULFILLED: { preset: "sky" },
      FULLY_COMPLETED: { preset: "emerald" },
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
    id: "net_amount",
    label: "Net amount",
    defaultVisible: true,
    align: "right",
    group: "Details",
    valueKind: "number",
    widths: W_AMOUNT,
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

export const PO_LIST_COLUMN_REGISTRY: ListColumnRegistry<PurchaseOrderListColumnId> = {
  ids: PO_LIST_COLUMN_IDS,
  columns: PO_LIST_COLUMNS,
  storageKey: "aib-po-list-columns",
};

export function getPurchaseOrderColumnDef(id: PurchaseOrderListColumnId) {
  return PO_LIST_COLUMNS.find((column) => column.id === id)!;
}
