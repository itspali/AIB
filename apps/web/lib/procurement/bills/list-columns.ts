import { columnWidths } from "@/lib/list-columns/sizing";
import { CHIP_DEFAULT_FALLBACK_KEY, type ListColumnDef, type ListColumnRegistry } from "@/lib/list-columns/types";
import { billMatchStatusLabel } from "@/lib/procurement/bills/three-way-match";
import type { BillMatchStatus } from "@/lib/procurement/bills/three-way-match";

export const BILL_LIST_COLUMN_IDS = [
  "bill_number",
  "invoice_number",
  "supplier",
  "purchase_order",
  "match_status",
  "liability",
  "paid",
  "created",
] as const;

export type PurchaseBillListColumnId = (typeof BILL_LIST_COLUMN_IDS)[number];

const W_CODE = columnWidths({ default: { min: 100, max: 160 } });
const W_NAME = columnWidths({ default: { min: 120, max: 220 } });
const W_STATUS = columnWidths({ default: { min: 120, max: 180 } });
const W_AMOUNT = columnWidths({ default: { min: 96, max: 140 } });
const W_PAID = columnWidths({ default: { min: 72, max: 96 } });
const W_DATE = columnWidths({ default: { min: 100, max: 140 } });

const BILL_MATCH_CHIP_CATALOG: Array<{ value: BillMatchStatus; label: string }> = (
  ["MATCHED", "PPV_HOLD", "VARIANCE"] as BillMatchStatus[]
).map((status) => ({
  value: status,
  label: billMatchStatusLabel(status),
}));

export const BILL_LIST_COLUMNS: ListColumnDef<PurchaseBillListColumnId>[] = [
  {
    id: "bill_number",
    label: "Bill number",
    defaultVisible: true,
    group: "Identity",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "invoice_number",
    label: "Vendor invoice",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_NAME,
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
    id: "purchase_order",
    label: "Purchase order",
    defaultVisible: true,
    group: "Reference",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "match_status",
    label: "Match status",
    defaultVisible: true,
    group: "Status",
    valueKind: "text",
    widths: W_STATUS,
    chipEligible: true,
    chipValueCatalog: BILL_MATCH_CHIP_CATALOG,
    chipDefaultColors: {
      MATCHED: { preset: "emerald" },
      PPV_HOLD: { preset: "amber" },
      VARIANCE: { preset: "sky" },
      [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
    },
  },
  {
    id: "liability",
    label: "Amount due",
    defaultVisible: true,
    align: "right",
    group: "Details",
    valueKind: "number",
    widths: W_AMOUNT,
  },
  {
    id: "paid",
    label: "Paid",
    defaultVisible: true,
    group: "Status",
    valueKind: "text",
    widths: W_PAID,
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

export const BILL_LIST_COLUMN_REGISTRY: ListColumnRegistry<PurchaseBillListColumnId> = {
  ids: BILL_LIST_COLUMN_IDS,
  columns: BILL_LIST_COLUMNS,
  storageKey: "aib-bill-list-columns",
};

export function getPurchaseBillColumnDef(id: PurchaseBillListColumnId) {
  return BILL_LIST_COLUMNS.find((column) => column.id === id)!;
}
