import { mergeFieldOrder, moveFieldInOrder } from "@/lib/documents/layout-order";
import {
  buildCatalogFieldId,
  isCatalogFieldId,
  VARIANT_ATTRIBUTES_ALL_ID,
} from "@/lib/documents/catalog-field-ids";
import type {
  DocumentColumnPref,
  DocumentCatalogFieldSource,
  DocumentHeaderSlot,
  DocumentImageDisplayMode,
  DocumentLayoutDefaults,
  DocumentLayoutTemplate,
  DocumentLineSlot,
} from "@/lib/documents/types";

export const GRN_LINE_COLUMN_IDS = [
  "item",
  "sku",
  "quantity_received",
  "quantity_accepted",
  "quantity_rejected",
  "raw_unit_cost",
  "total_final_landed_cost",
  "import_igst_amount",
  "customs_duty_amount",
] as const;

export type GrnLineColumnId = (typeof GRN_LINE_COLUMN_IDS)[number];

export const GRN_LINE_SETTINGS_COLUMN_IDS = [...GRN_LINE_COLUMN_IDS] as const satisfies readonly GrnLineColumnId[];

export type GrnLineSettingsColumnId = (typeof GRN_LINE_SETTINGS_COLUMN_IDS)[number];

export const GRN_LINE_IMAGE_COLUMN_ID = "line_image";

const GRN_LINE_IMAGE_COLUMN: DocumentColumnPref = {
  id: GRN_LINE_IMAGE_COLUMN_ID,
  label: "",
  defaultVisible: true,
  group: "line",
  align: "center",
};

export const GRN_HEADER_FIELD_IDS = [
  "destination",
  "purchase_order",
  "voucher_number",
  "received_at",
  "is_qc_pending",
  "bill_of_entry_number",
  "bill_of_entry_date",
  "port_code",
  "exchange_rate",
  "assessable_value",
  "customs_duty_header",
  "import_igst_header",
  "created_at",
] as const;

export type GrnHeaderFieldId = (typeof GRN_HEADER_FIELD_IDS)[number];

export const GRN_FORM_HEADER_PRIMARY_FIELD_IDS = [
  "destination",
  "purchase_order",
] as const satisfies readonly GrnHeaderFieldId[];

export const GRN_FORM_HEADER_DETAILS_FIELD_IDS = [
  "received_at",
  "is_qc_pending",
  "bill_of_entry_number",
  "bill_of_entry_date",
  "port_code",
  "exchange_rate",
  "assessable_value",
  "customs_duty_header",
  "import_igst_header",
] as const satisfies readonly GrnHeaderFieldId[];

export const GRN_FORM_HEADER_PLACEABLE_FIELD_IDS = [
  ...GRN_FORM_HEADER_PRIMARY_FIELD_IDS,
  ...GRN_FORM_HEADER_DETAILS_FIELD_IDS,
] as const;

export const GRN_TOTALS_FIELD_IDS = [] as const;
export type GrnTotalsFieldId = (typeof GRN_TOTALS_FIELD_IDS)[number];
export const GRN_TOTALS_INTERNAL_FIELD_IDS = [] as const;

const GRN_LINE_COLUMNS: DocumentColumnPref[] = [
  {
    id: "item",
    label: "Item",
    defaultVisible: true,
    group: "line",
    align: "left",
    lineSlot: "column",
  },
  {
    id: "sku",
    label: "SKU",
    defaultVisible: false,
    group: "line",
    align: "left",
    lineSlot: "item_detail",
    showLabel: true,
    itemDetailFlow: "new_line",
  },
  {
    id: "quantity_received",
    label: "Received",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 3,
    lineSlot: "column",
  },
  {
    id: "quantity_accepted",
    label: "Accepted",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 3,
    lineSlot: "column",
  },
  {
    id: "quantity_rejected",
    label: "Rejected",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 3,
    lineSlot: "column",
  },
  {
    id: "raw_unit_cost",
    label: "Unit cost",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "total_final_landed_cost",
    label: "Landed cost",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "import_igst_amount",
    label: "Import IGST",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "customs_duty_amount",
    label: "Customs duty",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
];

const GRN_CATALOG_LINE_COLUMNS: DocumentColumnPref[] = [
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
];

const GRN_HEADER_COLUMNS: DocumentColumnPref[] = [
  {
    id: "destination",
    label: "Location",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "primary",
  },
  {
    id: "purchase_order",
    label: "Purchase order",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "primary",
  },
  {
    id: "voucher_number",
    label: "GRN number",
    defaultVisible: true,
    group: "header",
    align: "left",
  },
  {
    id: "received_at",
    label: "Received",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "details",
  },
  {
    id: "is_qc_pending",
    label: "QC pending",
    defaultVisible: false,
    group: "header",
    align: "left",
    headerSlot: "details",
  },
  {
    id: "bill_of_entry_number",
    label: "Bill of entry",
    defaultVisible: false,
    group: "header",
    align: "left",
    headerSlot: "details",
  },
  {
    id: "bill_of_entry_date",
    label: "BOE date",
    defaultVisible: false,
    group: "header",
    align: "left",
    headerSlot: "details",
  },
  {
    id: "port_code",
    label: "Port code",
    defaultVisible: false,
    group: "header",
    align: "left",
    headerSlot: "details",
  },
  {
    id: "exchange_rate",
    label: "Exchange rate",
    defaultVisible: false,
    group: "header",
    align: "left",
    headerSlot: "details",
  },
  {
    id: "assessable_value",
    label: "Assessable value",
    defaultVisible: false,
    group: "header",
    align: "right",
    headerSlot: "details",
    decimalPlaces: 2,
  },
  {
    id: "customs_duty_header",
    label: "Customs duty (header)",
    defaultVisible: false,
    group: "header",
    align: "right",
    headerSlot: "details",
    decimalPlaces: 2,
  },
  {
    id: "import_igst_header",
    label: "Import IGST (header)",
    defaultVisible: false,
    group: "header",
    align: "right",
    headerSlot: "details",
    decimalPlaces: 2,
  },
  {
    id: "created_at",
    label: "Created",
    defaultVisible: false,
    group: "header",
    align: "left",
  },
];

export const DEFAULT_GRN_LINE_COLUMN_ORDER: GrnLineColumnId[] = [...GRN_LINE_COLUMN_IDS];
export const DEFAULT_GRN_CATALOG_LINE_FIELD_ORDER: string[] = GRN_CATALOG_LINE_COLUMNS.map((c) => c.id);
export const DEFAULT_GRN_HEADER_FIELD_ORDER: GrnHeaderFieldId[] = [...GRN_HEADER_FIELD_IDS];
export const DEFAULT_GRN_TOTALS_FIELD_ORDER: GrnTotalsFieldId[] = [];

export const DEFAULT_GRN_SCREEN_LAYOUT: DocumentLayoutTemplate = {
  moduleKey: "GOODS_RECEIPT_NOTE",
  viewContext: "SCREEN_GRID",
  columns: [...GRN_LINE_COLUMNS, ...GRN_CATALOG_LINE_COLUMNS, ...GRN_HEADER_COLUMNS],
  lineColumnOrder: [...DEFAULT_GRN_LINE_COLUMN_ORDER],
  catalogLineFieldOrder: [...DEFAULT_GRN_CATALOG_LINE_FIELD_ORDER],
  headerFieldOrder: [...DEFAULT_GRN_HEADER_FIELD_ORDER],
  totalsFieldOrder: [...DEFAULT_GRN_TOTALS_FIELD_ORDER],
  imageDisplayMode: "INLINE_CELL",
};

function columnMap(layout: DocumentLayoutDefaults): Map<string, DocumentColumnPref> {
  return new Map(layout.columns.map((column) => [column.id, column]));
}

function getColumnPref(layout: DocumentLayoutDefaults, columnId: string): DocumentColumnPref | undefined {
  return columnMap(layout).get(columnId);
}

function backfillHeaderSlots(columns: DocumentColumnPref[]): DocumentColumnPref[] {
  return columns.map((column) => {
    if (column.group !== "header" || column.headerSlot) return column;
    if ((GRN_FORM_HEADER_PRIMARY_FIELD_IDS as readonly string[]).includes(column.id)) {
      return { ...column, headerSlot: "primary" as const };
    }
    if ((GRN_FORM_HEADER_DETAILS_FIELD_IDS as readonly string[]).includes(column.id)) {
      return { ...column, headerSlot: "details" as const };
    }
    return column;
  });
}

function mergeCatalogLineFieldOrder(
  saved: readonly string[] | undefined,
  registryIds: readonly string[]
): string[] {
  if (!saved || saved.length === 0) return [...registryIds];
  const registrySet = new Set(registryIds);
  return saved.filter((id) => registrySet.has(id) || isCatalogFieldId(id));
}

export function mergeGrnColumnPrefs(saved: readonly DocumentColumnPref[]): DocumentColumnPref[] {
  const registry = DEFAULT_GRN_SCREEN_LAYOUT.columns;
  const savedById = new Map(saved.map((column) => [column.id, column]));
  const merged: DocumentColumnPref[] = [];

  for (const registryColumn of registry) {
    const savedColumn = savedById.get(registryColumn.id);
    merged.push(savedColumn ? { ...registryColumn, ...savedColumn, id: registryColumn.id } : registryColumn);
  }

  for (const column of saved) {
    if (!merged.some((entry) => entry.id === column.id)) merged.push(column);
  }

  return merged;
}

export function normalizeGrnLayoutTemplate(
  template: Partial<DocumentLayoutTemplate> | DocumentLayoutDefaults
): DocumentLayoutTemplate {
  const base = DEFAULT_GRN_SCREEN_LAYOUT;
  const rawColumns =
    template.columns && template.columns.length > 0
      ? mergeGrnColumnPrefs(template.columns)
      : base.columns;
  const columns = backfillHeaderSlots(rawColumns);

  return {
    moduleKey: template.moduleKey ?? base.moduleKey,
    viewContext: template.viewContext ?? base.viewContext,
    columns,
    lineColumnOrder: mergeFieldOrder(
      "lineColumnOrder" in template ? template.lineColumnOrder : undefined,
      GRN_LINE_COLUMN_IDS
    ),
    catalogLineFieldOrder: mergeCatalogLineFieldOrder(
      "catalogLineFieldOrder" in template ? template.catalogLineFieldOrder : undefined,
      DEFAULT_GRN_CATALOG_LINE_FIELD_ORDER
    ),
    headerFieldOrder: mergeFieldOrder(
      "headerFieldOrder" in template ? template.headerFieldOrder : undefined,
      GRN_HEADER_FIELD_IDS
    ),
    totalsFieldOrder: mergeFieldOrder(
      "totalsFieldOrder" in template ? template.totalsFieldOrder : undefined,
      GRN_TOTALS_FIELD_IDS
    ),
    imageDisplayMode:
      "imageDisplayMode" in template && template.imageDisplayMode
        ? template.imageDisplayMode
        : base.imageDisplayMode,
  };
}

export function isGrnFormHeaderPlaceableField(fieldId: string): boolean {
  return (GRN_FORM_HEADER_PLACEABLE_FIELD_IDS as readonly string[]).includes(fieldId);
}

export function getGrnLineSettingsColumnOrder(layout: DocumentLayoutTemplate): GrnLineSettingsColumnId[] {
  const normalized = normalizeGrnLayoutTemplate(layout);
  const settingsSet = new Set<string>(GRN_LINE_SETTINGS_COLUMN_IDS);
  return normalized.lineColumnOrder.filter((id): id is GrnLineSettingsColumnId => settingsSet.has(id));
}

export function orderedGrnLineColumns(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizeGrnLayoutTemplate(layout);
  return normalized.lineColumnOrder
    .map((id) => getColumnPref(normalized, id))
    .filter(
      (column): column is DocumentColumnPref =>
        !!column && (GRN_LINE_COLUMN_IDS as readonly string[]).includes(column.id)
    );
}

export function orderedGrnHeaderFields(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizeGrnLayoutTemplate(layout);
  return normalized.headerFieldOrder
    .map((id) => getColumnPref(normalized, id))
    .filter(
      (column): column is DocumentColumnPref =>
        !!column && (GRN_HEADER_FIELD_IDS as readonly string[]).includes(column.id)
    );
}

export function orderedCatalogLineFields(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizeGrnLayoutTemplate(layout);
  return normalized.catalogLineFieldOrder
    .map((id) => getColumnPref(normalized, id))
    .filter((column): column is DocumentColumnPref => !!column && isCatalogFieldId(column.id));
}

export function getVisibleGrnLineColumns(
  layout: DocumentLayoutDefaults = DEFAULT_GRN_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedGrnLineColumns(normalizeGrnLayoutTemplate(layout)).filter((column) => column.defaultVisible);
}

export function getVisibleCatalogLineFields(
  layout: DocumentLayoutDefaults = DEFAULT_GRN_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedCatalogLineFields(normalizeGrnLayoutTemplate(layout)).filter((column) => column.defaultVisible);
}

export function getVisibleHeaderFields(
  layout: DocumentLayoutTemplate = DEFAULT_GRN_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedGrnHeaderFields(layout).filter((column) => column.defaultVisible);
}

export function resolveLineFieldSlot(column: DocumentColumnPref): DocumentLineSlot {
  if (column.id === "item") return "column";
  if (column.lineSlot) return column.lineSlot;
  return "item_detail";
}

export function getColumnLineFields(
  layout: DocumentLayoutDefaults = DEFAULT_GRN_SCREEN_LAYOUT
): DocumentColumnPref[] {
  const visible = getVisibleGrnLineColumns(layout);
  const columns = visible.filter((column) => resolveLineFieldSlot(column) === "column");
  const item = columns.find((column) => column.id === "item");
  const rest = columns.filter((column) => column.id !== "item");
  return item ? [item, ...rest] : rest;
}

export function getItemDetailLineFields(
  layout: DocumentLayoutDefaults = DEFAULT_GRN_SCREEN_LAYOUT
): DocumentColumnPref[] {
  const commercial = getVisibleGrnLineColumns(layout).filter(
    (column) => resolveLineFieldSlot(column) === "item_detail"
  );
  const catalog = getVisibleCatalogLineFields(layout);
  return [...commercial, ...catalog];
}

export function getGrnLineEntryTableColumns(
  layout: DocumentLayoutDefaults = DEFAULT_GRN_SCREEN_LAYOUT
): DocumentColumnPref[] {
  const normalized = normalizeGrnLayoutTemplate(layout);
  const commercial = getColumnLineFields(normalized);
  if (normalized.imageDisplayMode !== "SEPARATE_COLUMN") return commercial;
  return [GRN_LINE_IMAGE_COLUMN, ...commercial];
}

export function getGrnLayoutColumnPref(
  layout: DocumentLayoutDefaults,
  columnId: string
): DocumentColumnPref | undefined {
  return normalizeGrnLayoutTemplate(layout).columns.find((column) => column.id === columnId);
}

export function patchGrnLayoutColumn(
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

export function moveGrnLineColumnOrder(
  layout: DocumentLayoutTemplate,
  fromId: GrnLineColumnId,
  toId: GrnLineColumnId
): DocumentLayoutTemplate {
  return {
    ...layout,
    lineColumnOrder: moveFieldInOrder(layout.lineColumnOrder, fromId, toId, { pinnedIds: ["item"] }),
  };
}

export function moveGrnHeaderFieldOrder(
  layout: DocumentLayoutTemplate,
  fromId: GrnHeaderFieldId,
  toId: GrnHeaderFieldId
): DocumentLayoutTemplate {
  return {
    ...layout,
    headerFieldOrder: moveFieldInOrder(layout.headerFieldOrder, fromId, toId),
  };
}

export function createGrnCatalogFieldPref(
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

export function addGrnCatalogField(
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

export function removeGrnCatalogField(
  layout: DocumentLayoutTemplate,
  fieldId: string
): DocumentLayoutTemplate {
  if (!isCatalogFieldId(fieldId)) return layout;
  return {
    ...layout,
    catalogLineFieldOrder: layout.catalogLineFieldOrder.filter((id) => id !== fieldId),
    columns: layout.columns.filter((column) => column.id !== fieldId),
  };
}

export function moveGrnCatalogLineFieldOrder(
  layout: DocumentLayoutTemplate,
  fromId: string,
  toId: string
): DocumentLayoutTemplate {
  return {
    ...layout,
    catalogLineFieldOrder: moveFieldInOrder(layout.catalogLineFieldOrder, fromId, toId),
  };
}
