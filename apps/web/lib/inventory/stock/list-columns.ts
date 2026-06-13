import { columnWidths } from "@/lib/list-columns/sizing";
import {
  CHIP_DEFAULT_FALLBACK_KEY,
  type ListColumnDef,
  type ListColumnRegistry,
} from "@/lib/list-columns/types";
import { STOCK_ADJUSTMENT_KINDS, stockAdjustmentKindLabel } from "@/lib/inventory/stock/labels";

export const STOCK_BALANCE_COLUMN_IDS = [
  "location",
  "item",
  "sku",
  "on_hand",
  "promo_on_hand",
  "avg_cost",
  "reorder",
] as const;

export type StockBalanceColumnId = (typeof STOCK_BALANCE_COLUMN_IDS)[number];

export const STOCK_ADJUSTMENT_COLUMN_IDS = [
  "document",
  "location",
  "kind",
  "reason",
  "lines",
  "posted",
] as const;

export type StockAdjustmentColumnId = (typeof STOCK_ADJUSTMENT_COLUMN_IDS)[number];

const W_LOCATION = columnWidths({ default: { min: 120, max: 200 } });
const W_ITEM = columnWidths({ default: { min: 140, max: 240 } });
const W_CODE = columnWidths({ default: { min: 100, max: 160 } });
const W_NUMBER = columnWidths({ default: { min: 72, max: 120 } });
const W_TEXT = columnWidths({ default: { min: 120, max: 220 } });
const W_DATE = columnWidths({ default: { min: 100, max: 140 } });

export const STOCK_BALANCE_LIST_COLUMNS: ListColumnDef<StockBalanceColumnId>[] = [
  {
    id: "location",
    label: "Location",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_LOCATION,
  },
  {
    id: "item",
    label: "Item",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_ITEM,
  },
  {
    id: "sku",
    label: "SKU",
    defaultVisible: true,
    group: "Identity",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "on_hand",
    label: "Sellable",
    defaultVisible: true,
    align: "right",
    group: "Inventory",
    valueKind: "number",
    widths: W_NUMBER,
  },
  {
    id: "promo_on_hand",
    label: "Promo / sample",
    defaultVisible: true,
    align: "right",
    group: "Inventory",
    valueKind: "number",
    widths: W_NUMBER,
  },
  {
    id: "avg_cost",
    label: "Avg cost",
    defaultVisible: true,
    align: "right",
    group: "Inventory",
    valueKind: "number",
    widths: W_NUMBER,
  },
  {
    id: "reorder",
    label: "Reorder",
    defaultVisible: true,
    align: "right",
    group: "Inventory",
    valueKind: "number",
    widths: W_NUMBER,
  },
];

export const STOCK_ADJUSTMENT_LIST_COLUMNS: ListColumnDef<StockAdjustmentColumnId>[] = [
  {
    id: "document",
    label: "Document",
    defaultVisible: true,
    group: "Identity",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "location",
    label: "Location",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_LOCATION,
  },
  {
    id: "kind",
    label: "Kind",
    defaultVisible: true,
    group: "Details",
    valueKind: "text",
    widths: W_TEXT,
    chipEligible: true,
    chipValueCatalog: STOCK_ADJUSTMENT_KINDS.map((kind) => ({
      value: kind,
      label: stockAdjustmentKindLabel(kind),
    })),
    chipDefaultColors: {
      OPENING: { preset: "sky" },
      CORRECTION: { preset: "amber" },
      WRITE_OFF: { preset: "red" },
      [CHIP_DEFAULT_FALLBACK_KEY]: { preset: "neutral" },
    },
  },
  {
    id: "reason",
    label: "Reason",
    defaultVisible: true,
    group: "Details",
    valueKind: "multiline",
    widths: W_TEXT,
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
    id: "posted",
    label: "Posted",
    defaultVisible: true,
    group: "Timestamps",
    valueKind: "date",
    widths: W_DATE,
  },
];

export const STOCK_BALANCE_COLUMN_REGISTRY: ListColumnRegistry<StockBalanceColumnId> = {
  ids: STOCK_BALANCE_COLUMN_IDS,
  columns: STOCK_BALANCE_LIST_COLUMNS,
  storageKey: "aib-stock-balance-list-columns",
};

export const STOCK_ADJUSTMENT_COLUMN_REGISTRY: ListColumnRegistry<StockAdjustmentColumnId> = {
  ids: STOCK_ADJUSTMENT_COLUMN_IDS,
  columns: STOCK_ADJUSTMENT_LIST_COLUMNS,
  storageKey: "aib-stock-adjustment-list-columns",
};

export function getStockBalanceColumnDef(id: StockBalanceColumnId) {
  return STOCK_BALANCE_LIST_COLUMNS.find((column) => column.id === id)!;
}

export function getStockAdjustmentColumnDef(id: StockAdjustmentColumnId) {
  return STOCK_ADJUSTMENT_LIST_COLUMNS.find((column) => column.id === id)!;
}
