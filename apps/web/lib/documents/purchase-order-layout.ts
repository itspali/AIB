import type { DocumentColumnPref, DocumentLayoutDefaults } from "@/lib/documents/types";

/** Line grid column ids — includes Phase 3 discount columns (hidden by default). */
export const PO_LINE_COLUMN_IDS = [
  "item",
  "quantity_ordered",
  "unit",
  "unit_price",
  "discount_pct",
  "discount_amount",
  "line_total",
] as const;

export type PoLineColumnId = (typeof PO_LINE_COLUMN_IDS)[number];

export const PO_HEADER_FIELD_IDS = [
  "supplier",
  "destination",
  "voucher_number",
  "payment_terms_days",
  "requisition_number",
  "expected_delivery_date",
  "internal_notes",
] as const;

export type PoHeaderFieldId = (typeof PO_HEADER_FIELD_IDS)[number];

const PO_LINE_COLUMNS: DocumentColumnPref[] = [
  {
    id: "item",
    label: "Item",
    defaultVisible: true,
    group: "line",
    align: "left",
  },
  {
    id: "quantity_ordered",
    label: "Qty",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 3,
  },
  {
    id: "unit",
    label: "Unit",
    defaultVisible: false,
    group: "line",
    align: "left",
  },
  {
    id: "unit_price",
    label: "Unit price (ex tax)",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 2,
  },
  {
    id: "discount_pct",
    label: "Disc %",
    defaultVisible: false,
    group: "line",
    align: "right",
  },
  {
    id: "discount_amount",
    label: "Disc amount",
    defaultVisible: false,
    group: "line",
    align: "right",
  },
  {
    id: "line_total",
    label: "Line total",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 2,
  },
];

export const DEFAULT_PO_SCREEN_LAYOUT: DocumentLayoutDefaults = {
  moduleKey: "PURCHASE_ORDER",
  viewContext: "SCREEN_GRID",
  columns: PO_LINE_COLUMNS,
};

export function getVisiblePoLineColumns(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return layout.columns.filter((column) => column.defaultVisible);
}

export function isPoLineColumnVisible(
  columnId: PoLineColumnId,
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): boolean {
  return layout.columns.find((column) => column.id === columnId)?.defaultVisible ?? false;
}
