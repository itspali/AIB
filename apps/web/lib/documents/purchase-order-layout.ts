import { mergeFieldOrder, moveFieldInOrder } from "@/lib/documents/layout-order";
import {
  buildCatalogFieldId,
  isCatalogFieldId,
  VARIANT_ATTRIBUTES_ALL_ID,
} from "@/lib/documents/catalog-field-ids";
import type {
  DocumentColumnPref,
  DocumentCatalogFieldSource,
  DocumentImageDisplayMode,
  DocumentLayoutDefaults,
  DocumentLayoutTemplate,
  DocumentLineSlot,
} from "@/lib/documents/types";

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

/** Synthetic grid column when imageDisplayMode is SEPARATE_COLUMN. */
export const PO_LINE_IMAGE_COLUMN_ID = "line_image";

const PO_LINE_IMAGE_COLUMN: DocumentColumnPref = {
  id: PO_LINE_IMAGE_COLUMN_ID,
  label: "",
  defaultVisible: true,
  group: "line",
  align: "center",
};

/** Peek-only line column (fulfillment progress). */
export const PO_PEEK_LINE_COLUMN_IDS = ["quantity_received"] as const;

export type PoPeekLineColumnId = (typeof PO_PEEK_LINE_COLUMN_IDS)[number];

/** @deprecated Prefer lineSlot on column prefs. Fallback when lineSlot is unset. */
export const PO_COMPACT_PRIMARY_LINE_COLUMN_IDS = [
  "item",
  "quantity_ordered",
  "unit_price",
  "line_total",
] as const satisfies readonly PoLineColumnId[];

export type PoCompactPrimaryLineColumnId = (typeof PO_COMPACT_PRIMARY_LINE_COLUMN_IDS)[number];

export const PO_HEADER_FIELD_IDS = [
  "supplier",
  "destination",
  "currency",
  "voucher_number",
  "payment_terms_days",
  "requisition_number",
  "expected_delivery_date",
  "internal_notes",
  "document_status",
  "updated_at",
] as const;

export type PoHeaderFieldId = (typeof PO_HEADER_FIELD_IDS)[number];

export const PO_TOTALS_FIELD_IDS = [
  "line_count",
  "subtotal_ex_tax",
  "tax_amount",
  "grand_total",
] as const;

export type PoTotalsFieldId = (typeof PO_TOTALS_FIELD_IDS)[number];

/** Line columns that require Phase 3 commercial schema before use in the drawer. */
export const PO_PHASE3_LINE_COLUMN_IDS = ["discount_pct", "discount_amount"] as const;

const PO_LINE_COLUMNS: DocumentColumnPref[] = [
  {
    id: "item",
    label: "Item",
    defaultVisible: true,
    group: "line",
    align: "left",
    lineSlot: "column",
  },
  {
    id: "quantity_ordered",
    label: "Qty",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 3,
    lineSlot: "column",
  },
  {
    id: "unit",
    label: "Unit",
    defaultVisible: false,
    group: "line",
    align: "left",
    lineSlot: "item_detail",
    showLabel: true,
    itemDetailFlow: "new_line",
  },
  {
    id: "unit_price",
    label: "Unit price (ex tax)",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "discount_pct",
    label: "Disc %",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "item_detail",
    showLabel: true,
    itemDetailFlow: "inline_previous",
  },
  {
    id: "discount_amount",
    label: "Disc amount",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "item_detail",
    showLabel: true,
    itemDetailFlow: "inline_previous",
  },
  {
    id: "line_total",
    label: "Line total",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
];

const PO_CATALOG_LINE_COLUMNS: DocumentColumnPref[] = [
  {
    id: VARIANT_ATTRIBUTES_ALL_ID,
    label: "Variant attributes",
    defaultVisible: true,
    group: "catalog",
    lineSlot: "item_detail",
    showLabel: false,
    itemDetailFlow: "new_line",
    catalogSource: "variant_attributes_all",
    catalogSourceKey: "__all__",
  },
  {
    id: buildCatalogFieldId("item_column", "hsn_sac_code"),
    label: "HSN/SAC",
    defaultVisible: false,
    group: "catalog",
    lineSlot: "item_detail",
    showLabel: true,
    itemDetailFlow: "new_line",
    catalogSource: "item_column",
    catalogSourceKey: "hsn_sac_code",
  },
  {
    id: buildCatalogFieldId("item_column", "description"),
    label: "Description",
    defaultVisible: false,
    group: "catalog",
    lineSlot: "item_detail",
    showLabel: true,
    itemDetailFlow: "new_line",
    catalogSource: "item_column",
    catalogSourceKey: "description",
  },
  {
    id: buildCatalogFieldId("item_column", "base_unit_of_measure"),
    label: "Base unit",
    defaultVisible: false,
    group: "catalog",
    lineSlot: "item_detail",
    showLabel: true,
    itemDetailFlow: "inline_previous",
    catalogSource: "item_column",
    catalogSourceKey: "base_unit_of_measure",
  },
];

const PO_PEEK_LINE_COLUMNS: DocumentColumnPref[] = [
  {
    id: "quantity_received",
    label: "Received",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 3,
  },
];

const PO_HEADER_COLUMNS: DocumentColumnPref[] = [
  { id: "supplier", label: "Supplier", defaultVisible: true, group: "header", align: "left" },
  { id: "destination", label: "Destination", defaultVisible: true, group: "header", align: "left" },
  { id: "currency", label: "Currency", defaultVisible: true, group: "header", align: "left" },
  {
    id: "voucher_number",
    label: "PO number",
    defaultVisible: true,
    group: "header",
    align: "left",
  },
  {
    id: "payment_terms_days",
    label: "Payment terms (days)",
    defaultVisible: true,
    group: "header",
    align: "left",
  },
  {
    id: "requisition_number",
    label: "Requisition #",
    defaultVisible: true,
    group: "header",
    align: "left",
  },
  {
    id: "expected_delivery_date",
    label: "Expected delivery",
    defaultVisible: true,
    group: "header",
    align: "left",
  },
  {
    id: "internal_notes",
    label: "Internal notes",
    defaultVisible: true,
    group: "header",
    align: "left",
  },
  {
    id: "document_status",
    label: "Status",
    defaultVisible: true,
    group: "header",
    align: "left",
  },
  {
    id: "updated_at",
    label: "Updated",
    defaultVisible: false,
    group: "header",
    align: "left",
  },
];

const PO_TOTALS_COLUMNS: DocumentColumnPref[] = [
  { id: "line_count", label: "Lines", defaultVisible: true, group: "totals", align: "right" },
  {
    id: "subtotal_ex_tax",
    label: "Subtotal (ex tax)",
    defaultVisible: true,
    group: "totals",
    align: "right",
    decimalPlaces: 2,
  },
  {
    id: "tax_amount",
    label: "Tax",
    defaultVisible: true,
    group: "totals",
    align: "right",
    decimalPlaces: 2,
  },
  {
    id: "grand_total",
    label: "Total",
    defaultVisible: true,
    group: "totals",
    align: "right",
    decimalPlaces: 2,
  },
];

export const DEFAULT_PO_LINE_COLUMN_ORDER: PoLineColumnId[] = [...PO_LINE_COLUMN_IDS];
export const DEFAULT_PO_CATALOG_LINE_FIELD_ORDER: string[] = PO_CATALOG_LINE_COLUMNS.map(
  (column) => column.id
);
export const DEFAULT_PO_HEADER_FIELD_ORDER: PoHeaderFieldId[] = [...PO_HEADER_FIELD_IDS];
export const DEFAULT_PO_TOTALS_FIELD_ORDER: PoTotalsFieldId[] = [...PO_TOTALS_FIELD_IDS];

export const DEFAULT_PO_SCREEN_LAYOUT: DocumentLayoutTemplate = {
  moduleKey: "PURCHASE_ORDER",
  viewContext: "SCREEN_GRID",
  columns: [
    ...PO_LINE_COLUMNS,
    ...PO_CATALOG_LINE_COLUMNS,
    ...PO_PEEK_LINE_COLUMNS,
    ...PO_HEADER_COLUMNS,
    ...PO_TOTALS_COLUMNS,
  ],
  lineColumnOrder: [...DEFAULT_PO_LINE_COLUMN_ORDER],
  catalogLineFieldOrder: [...DEFAULT_PO_CATALOG_LINE_FIELD_ORDER],
  headerFieldOrder: [...DEFAULT_PO_HEADER_FIELD_ORDER],
  totalsFieldOrder: [...DEFAULT_PO_TOTALS_FIELD_ORDER],
  imageDisplayMode: "INLINE_CELL",
};

function columnMap(layout: DocumentLayoutDefaults): Map<string, DocumentColumnPref> {
  return new Map(layout.columns.map((column) => [column.id, column]));
}

function getColumnPref(
  layout: DocumentLayoutDefaults,
  columnId: string
): DocumentColumnPref | undefined {
  return columnMap(layout).get(columnId);
}

export function isPoPhase3LineColumn(columnId: string): boolean {
  return (PO_PHASE3_LINE_COLUMN_IDS as readonly string[]).includes(columnId);
}

export function normalizePoLayoutTemplate(
  template: Partial<DocumentLayoutTemplate> | DocumentLayoutDefaults
): DocumentLayoutTemplate {
  const base = DEFAULT_PO_SCREEN_LAYOUT;
  const columns =
    template.columns && template.columns.length > 0
      ? mergePoColumnPrefs(template.columns)
      : base.columns;

  return {
    moduleKey: template.moduleKey ?? base.moduleKey,
    viewContext: template.viewContext ?? base.viewContext,
    columns,
    lineColumnOrder: mergeFieldOrder(
      "lineColumnOrder" in template ? template.lineColumnOrder : undefined,
      PO_LINE_COLUMN_IDS
    ),
    catalogLineFieldOrder: mergeCatalogLineFieldOrder(
      "catalogLineFieldOrder" in template ? template.catalogLineFieldOrder : undefined,
      DEFAULT_PO_CATALOG_LINE_FIELD_ORDER
    ),
    headerFieldOrder: mergeFieldOrder(
      "headerFieldOrder" in template ? template.headerFieldOrder : undefined,
      PO_HEADER_FIELD_IDS
    ),
    totalsFieldOrder: mergeFieldOrder(
      "totalsFieldOrder" in template ? template.totalsFieldOrder : undefined,
      PO_TOTALS_FIELD_IDS
    ),
    imageDisplayMode:
      "imageDisplayMode" in template && template.imageDisplayMode
        ? template.imageDisplayMode
        : base.imageDisplayMode,
  };
}

/** Merge saved catalog field order with registry ids (new fields appended). */
function mergeCatalogLineFieldOrder(
  saved: readonly string[] | undefined,
  registryIds: readonly string[]
): string[] {
  if (!saved || saved.length === 0) return [...registryIds];
  const registrySet = new Set(registryIds);
  const merged = saved.filter((id) => registrySet.has(id) || isCatalogFieldId(id));
  for (const id of registryIds) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

/** Merge saved prefs with registry defaults (new fields appended). */
export function mergePoColumnPrefs(saved: readonly DocumentColumnPref[]): DocumentColumnPref[] {
  const registry = DEFAULT_PO_SCREEN_LAYOUT.columns;
  const savedById = new Map(saved.map((column) => [column.id, column]));
  const merged: DocumentColumnPref[] = [];

  for (const registryColumn of registry) {
    merged.push(savedById.get(registryColumn.id) ?? registryColumn);
  }

  for (const column of saved) {
    if (!merged.some((entry) => entry.id === column.id)) merged.push(column);
  }

  return merged;
}

export function getVisiblePoLineColumns(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  const normalized = normalizePoLayoutTemplate(layout);
  return orderedLineColumns(normalized).filter((column) => column.defaultVisible);
}

export function orderedCatalogLineFields(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizePoLayoutTemplate(layout);
  return normalized.catalogLineFieldOrder
    .map((id) => getColumnPref(normalized, id))
    .filter((column): column is DocumentColumnPref => !!column && isCatalogFieldId(column.id));
}

export function getVisibleCatalogLineFields(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedCatalogLineFields(normalizePoLayoutTemplate(layout)).filter(
    (column) => column.defaultVisible
  );
}

export function createPoCatalogFieldPref(
  source: DocumentCatalogFieldSource,
  key: string,
  label?: string
): DocumentColumnPref {
  const id = buildCatalogFieldId(source, key);
  const resolvedLabel =
    label?.trim() ||
    (source === "variant_attributes_all"
      ? "Variant attributes"
      : key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()));

  return {
    id,
    label: resolvedLabel,
    defaultVisible: true,
    group: "catalog",
    lineSlot: "item_detail",
    showLabel: source !== "variant_attributes_all",
    itemDetailFlow:
      source === "variant_attribute" || source === "item_custom_field"
        ? "inline_previous"
        : "new_line",
    catalogSource: source,
    catalogSourceKey: key,
  };
}

export function addPoCatalogField(
  layout: DocumentLayoutTemplate,
  pref: DocumentColumnPref
): DocumentLayoutTemplate {
  const exists = layout.columns.some((column) => column.id === pref.id);
  return {
    ...layout,
    columns: exists ? layout.columns : [...layout.columns, pref],
    catalogLineFieldOrder: layout.catalogLineFieldOrder.includes(pref.id)
      ? layout.catalogLineFieldOrder
      : [...layout.catalogLineFieldOrder, pref.id],
  };
}

export function removePoCatalogField(
  layout: DocumentLayoutTemplate,
  fieldId: string
): DocumentLayoutTemplate {
  return {
    ...layout,
    catalogLineFieldOrder: layout.catalogLineFieldOrder.filter((id) => id !== fieldId),
  };
}

export function movePoCatalogLineFieldOrder(
  layout: DocumentLayoutTemplate,
  fromId: string,
  toId: string
): DocumentLayoutTemplate {
  return {
    ...layout,
    catalogLineFieldOrder: moveFieldInOrder(layout.catalogLineFieldOrder, fromId, toId),
  };
}

export function orderedLineColumns(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizePoLayoutTemplate(layout);
  return normalized.lineColumnOrder
    .map((id) => getColumnPref(normalized, id))
    .filter(
      (column): column is DocumentColumnPref =>
        !!column && (PO_LINE_COLUMN_IDS as readonly string[]).includes(column.id)
    );
}

export function orderedHeaderFields(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizePoLayoutTemplate(layout);
  return normalized.headerFieldOrder
    .map((id) => getColumnPref(normalized, id))
    .filter(
      (column): column is DocumentColumnPref =>
        !!column && (PO_HEADER_FIELD_IDS as readonly string[]).includes(column.id)
    );
}

export function orderedTotalsFields(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizePoLayoutTemplate(layout);
  return normalized.totalsFieldOrder
    .map((id) => getColumnPref(normalized, id))
    .filter(
      (column): column is DocumentColumnPref =>
        !!column && (PO_TOTALS_FIELD_IDS as readonly string[]).includes(column.id)
    );
}

export function getPoLayoutColumnPref(
  layout: DocumentLayoutDefaults,
  columnId: string
): DocumentColumnPref | undefined {
  return normalizePoLayoutTemplate(layout).columns.find((column) => column.id === columnId);
}

export function resolveLineFieldSlot(column: DocumentColumnPref): DocumentLineSlot {
  if (column.id === "item") return "column";
  if (column.lineSlot) return column.lineSlot;
  return (PO_COMPACT_PRIMARY_LINE_COLUMN_IDS as readonly string[]).includes(column.id)
    ? "column"
    : "item_detail";
}

export function getColumnLineFields(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  const visible = getVisiblePoLineColumns(layout);
  const columns = visible.filter((column) => resolveLineFieldSlot(column) === "column");
  const item = columns.find((column) => column.id === "item");
  const rest = columns.filter((column) => column.id !== "item");
  return item ? [item, ...rest] : rest;
}

export function resolvePoLineImageDisplayMode(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): DocumentImageDisplayMode {
  return normalizePoLayoutTemplate(layout).imageDisplayMode;
}

export function shouldShowPoLineInlineImage(mode: DocumentImageDisplayMode): boolean {
  return mode === "INLINE_CELL";
}

export function shouldShowPoLineImageColumn(mode: DocumentImageDisplayMode): boolean {
  return mode === "SEPARATE_COLUMN";
}

/** Drawer line grid columns including optional image column. */
export function getPoLineEntryTableColumns(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  const normalized = normalizePoLayoutTemplate(layout);
  const commercial = getColumnLineFields(normalized);
  if (normalized.imageDisplayMode !== "SEPARATE_COLUMN") {
    return commercial;
  }
  return [PO_LINE_IMAGE_COLUMN, ...commercial];
}

/** Visible line fields rendered under the item cell in compact drawer mode. */
export function getItemDetailLineFields(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  const commercial = getVisiblePoLineColumns(layout).filter(
    (column) => resolveLineFieldSlot(column) === "item_detail"
  );
  const catalog = getVisibleCatalogLineFields(layout);
  return [...commercial, ...catalog];
}

/** @deprecated Use getColumnLineFields */
export function getCompactPoTableColumns(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return getColumnLineFields(layout);
}

/** @deprecated Use getItemDetailLineFields */
export function getNestedUnderItemPoLineColumns(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return getItemDetailLineFields(layout);
}

/** Flat visible line columns for peek / print (respects saved order). */
export function getFlatPoLineColumns(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return getVisiblePoLineColumns(layout);
}

export function getVisibleHeaderFields(
  layout: DocumentLayoutTemplate = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedHeaderFields(layout).filter((column) => column.defaultVisible);
}

export function isPoHeaderFieldVisible(
  fieldId: PoHeaderFieldId,
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): boolean {
  return getPoLayoutColumnPref(layout, fieldId)?.defaultVisible ?? false;
}

export function getVisibleTotalsFields(
  layout: DocumentLayoutTemplate = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedTotalsFields(layout).filter((column) => column.defaultVisible);
}

export function isPoLineColumnVisible(
  columnId: PoLineColumnId,
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): boolean {
  return layout.columns.find((column) => column.id === columnId)?.defaultVisible ?? false;
}

export function patchPoLayoutColumn(
  layout: DocumentLayoutTemplate,
  columnId: string,
  patch: Partial<DocumentColumnPref>
): DocumentLayoutTemplate {
  return {
    ...layout,
    columns: layout.columns.map((column) =>
      column.id === columnId ? { ...column, ...patch, id: column.id } : column
    ),
  };
}

export function movePoLineColumnOrder(
  layout: DocumentLayoutTemplate,
  fromId: PoLineColumnId,
  toId: PoLineColumnId
): DocumentLayoutTemplate {
  return movePoLayoutFieldOrder(layout, "lineColumnOrder", fromId, toId, ["item"]);
}

export function movePoHeaderFieldOrder(
  layout: DocumentLayoutTemplate,
  fromId: PoHeaderFieldId,
  toId: PoHeaderFieldId
): DocumentLayoutTemplate {
  return movePoLayoutFieldOrder(layout, "headerFieldOrder", fromId, toId);
}

export function movePoTotalsFieldOrder(
  layout: DocumentLayoutTemplate,
  fromId: PoTotalsFieldId,
  toId: PoTotalsFieldId
): DocumentLayoutTemplate {
  return movePoLayoutFieldOrder(layout, "totalsFieldOrder", fromId, toId);
}

function movePoLayoutFieldOrder<TId extends string>(
  layout: DocumentLayoutTemplate,
  orderKey: "lineColumnOrder" | "headerFieldOrder" | "totalsFieldOrder",
  fromId: TId,
  toId: TId,
  pinnedIds?: readonly TId[]
): DocumentLayoutTemplate {
  const current = layout[orderKey] as TId[];
  return {
    ...layout,
    [orderKey]: moveFieldInOrder(current, fromId, toId, { pinnedIds }),
  };
}
