import { columnWidths } from "@/lib/list-columns/sizing";
import { CHIP_DEFAULT_FALLBACK_KEY, type ListColumnDef, type ListColumnRegistry } from "@/lib/list-columns/types";
import { salesOrderStatusLabel } from "@/lib/sales/orders/labels";
import type { SalesOrderStatus } from "@/lib/sales/orders/types";

export const SO_LIST_COLUMN_IDS = [
  "so_number",
  "customer",
  "shipping_location",
  "status",
  "source_quote",
  "lines",
  "net_amount",
  "created",
  "created_by",
  "updated",
] as const;

export type SalesOrderListColumnId = (typeof SO_LIST_COLUMN_IDS)[number];

const W_CODE = columnWidths({ default: { min: 100, max: 160 } });
const W_NAME = columnWidths({ default: { min: 120, max: 220 } });
const W_STATUS = columnWidths({ default: { min: 120, max: 180 } });
const W_NUMBER = columnWidths({ default: { min: 72, max: 96 } });
const W_AMOUNT = columnWidths({ default: { min: 96, max: 140 } });
const W_DATE = columnWidths({ default: { min: 100, max: 140 } });

const SO_STATUS_CHIP_CATALOG: Array<{ value: SalesOrderStatus; label: string }> = (
  [
    "DRAFT",
    "PENDING_APPROVAL",
    "CREDIT_HOLD",
    "APPROVED_ACTIVE",
    "PARTIALLY_SHIPPED",
    "FULLY_COMPLETED",
    "CANCELLED",
  ] as SalesOrderStatus[]
).map((status) => ({
  value: status,
  label: salesOrderStatusLabel(status),
}));

export const SO_LIST_COLUMNS: ListColumnDef<SalesOrderListColumnId>[] = [
  {
    id: "so_number",
    label: "SO number",
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
    id: "shipping_location",
    label: "Ship from",
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
    chipValueCatalog: SO_STATUS_CHIP_CATALOG,
    chipDefaultColors: {
      DRAFT: { preset: "slate" },
      PENDING_APPROVAL: { preset: "amber" },
      CREDIT_HOLD: { preset: "amber" },
      APPROVED_ACTIVE: { preset: "indigo" },
      PARTIALLY_SHIPPED: { preset: "sky" },
      FULLY_COMPLETED: { preset: "emerald" },
      CANCELLED: { preset: "neutral" },
      [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
    },
  },
  {
    id: "source_quote",
    label: "Source quote",
    defaultVisible: false,
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
    defaultVisible: true,
    group: "Timestamps",
    valueKind: "date",
    widths: W_DATE,
  },
  {
    id: "created_by",
    label: "Created by",
    defaultVisible: false,
    group: "Timestamps",
    valueKind: "text",
    widths: W_NAME,
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

export const SO_LIST_COLUMN_REGISTRY: ListColumnRegistry<SalesOrderListColumnId> = {
  ids: SO_LIST_COLUMN_IDS,
  columns: SO_LIST_COLUMNS,
  storageKey: "aib-so-list-columns",
};

export function getSalesOrderColumnDef(id: SalesOrderListColumnId) {
  return SO_LIST_COLUMNS.find((column) => column.id === id)!;
}
