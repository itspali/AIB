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

export const BILL_LINE_COLUMN_IDS = [
  "item",
  "sku",
  "quantity_billed",
  "unit_price_billed",
  "po_unit_price",
  "grn_landed_unit_cost",
  "line_tax_computed",
] as const;

export type BillLineColumnId = (typeof BILL_LINE_COLUMN_IDS)[number];

export const BILL_LINE_SETTINGS_COLUMN_IDS = [...BILL_LINE_COLUMN_IDS] as const satisfies readonly BillLineColumnId[];

export type BillLineSettingsColumnId = (typeof BILL_LINE_SETTINGS_COLUMN_IDS)[number];

export const BILL_LINE_IMAGE_COLUMN_ID = "line_image";

const BILL_LINE_IMAGE_COLUMN: DocumentColumnPref = {
  id: BILL_LINE_IMAGE_COLUMN_ID,
  label: "",
  defaultVisible: true,
  group: "line",
  align: "center",
};

export const BILL_HEADER_FIELD_IDS = [
  "supplier",
  "invoice_number_vendor",
  "system_voucher_number",
  "purchase_order",
  "match_status",
  "tax_treatment",
  "created_at",
] as const;

export type BillHeaderFieldId = (typeof BILL_HEADER_FIELD_IDS)[number];

export const BILL_FORM_HEADER_PRIMARY_FIELD_IDS = [
  "supplier",
  "invoice_number_vendor",
  "purchase_order",
] as const satisfies readonly BillHeaderFieldId[];

export const BILL_FORM_HEADER_DETAILS_FIELD_IDS = [
  "match_status",
  "tax_treatment",
  "created_at",
] as const satisfies readonly BillHeaderFieldId[];

export const BILL_FORM_HEADER_PLACEABLE_FIELD_IDS = [
  ...BILL_FORM_HEADER_PRIMARY_FIELD_IDS,
  ...BILL_FORM_HEADER_DETAILS_FIELD_IDS,
] as const;

export const BILL_TOTALS_FIELD_IDS = [
  "total_gross_amount",
  "total_tax_amount",
  "total_liability_amount",
] as const;

export type BillTotalsFieldId = (typeof BILL_TOTALS_FIELD_IDS)[number];

export const BILL_TOTALS_INTERNAL_FIELD_IDS = [] as const;

const BILL_LINE_COLUMNS: DocumentColumnPref[] = [
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
    id: "quantity_billed",
    label: "Qty billed",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 3,
    lineSlot: "column",
  },
  {
    id: "unit_price_billed",
    label: "Unit price",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "po_unit_price",
    label: "PO price",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "grn_landed_unit_cost",
    label: "GRN landed cost",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "line_tax_computed",
    label: "Line tax",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
];

const BILL_CATALOG_LINE_COLUMNS: DocumentColumnPref[] = [
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

const BILL_HEADER_COLUMNS: DocumentColumnPref[] = [
  {
    id: "supplier",
    label: "Supplier",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "primary",
  },
  {
    id: "invoice_number_vendor",
    label: "Vendor invoice",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "primary",
  },
  {
    id: "system_voucher_number",
    label: "System bill #",
    defaultVisible: true,
    group: "header",
    align: "left",
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
    id: "match_status",
    label: "Match status",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "details",
  },
  {
    id: "tax_treatment",
    label: "Tax treatment",
    defaultVisible: false,
    group: "header",
    align: "left",
    headerSlot: "details",
  },
  {
    id: "created_at",
    label: "Created",
    defaultVisible: false,
    group: "header",
    align: "left",
    headerSlot: "details",
  },
];

const BILL_TOTALS_COLUMNS: DocumentColumnPref[] = [
  {
    id: "total_gross_amount",
    label: "Gross",
    defaultVisible: true,
    group: "totals",
    align: "right",
    decimalPlaces: 2,
  },
  {
    id: "total_tax_amount",
    label: "Tax",
    defaultVisible: true,
    group: "totals",
    align: "right",
    decimalPlaces: 2,
  },
  {
    id: "total_liability_amount",
    label: "Amount due",
    defaultVisible: true,
    group: "totals",
    align: "right",
    decimalPlaces: 2,
  },
];

export const DEFAULT_BILL_LINE_COLUMN_ORDER: BillLineColumnId[] = [...BILL_LINE_COLUMN_IDS];
export const DEFAULT_BILL_CATALOG_LINE_FIELD_ORDER: string[] = BILL_CATALOG_LINE_COLUMNS.map((c) => c.id);
export const DEFAULT_BILL_HEADER_FIELD_ORDER: BillHeaderFieldId[] = [...BILL_HEADER_FIELD_IDS];
export const DEFAULT_BILL_TOTALS_FIELD_ORDER: BillTotalsFieldId[] = [...BILL_TOTALS_FIELD_IDS];

export const DEFAULT_BILL_SCREEN_LAYOUT: DocumentLayoutTemplate = {
  moduleKey: "PURCHASE_INVOICE",
  viewContext: "SCREEN_GRID",
  columns: [...BILL_LINE_COLUMNS, ...BILL_CATALOG_LINE_COLUMNS, ...BILL_HEADER_COLUMNS, ...BILL_TOTALS_COLUMNS],
  lineColumnOrder: [...DEFAULT_BILL_LINE_COLUMN_ORDER],
  catalogLineFieldOrder: [...DEFAULT_BILL_CATALOG_LINE_FIELD_ORDER],
  headerFieldOrder: [...DEFAULT_BILL_HEADER_FIELD_ORDER],
  totalsFieldOrder: [...DEFAULT_BILL_TOTALS_FIELD_ORDER],
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
    if ((BILL_FORM_HEADER_PRIMARY_FIELD_IDS as readonly string[]).includes(column.id)) {
      return { ...column, headerSlot: "primary" as const };
    }
    if ((BILL_FORM_HEADER_DETAILS_FIELD_IDS as readonly string[]).includes(column.id)) {
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

export function mergeBillColumnPrefs(saved: readonly DocumentColumnPref[]): DocumentColumnPref[] {
  const registry = DEFAULT_BILL_SCREEN_LAYOUT.columns;
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

export function normalizeBillLayoutTemplate(
  template: Partial<DocumentLayoutTemplate> | DocumentLayoutDefaults
): DocumentLayoutTemplate {
  const base = DEFAULT_BILL_SCREEN_LAYOUT;
  const rawColumns =
    template.columns && template.columns.length > 0
      ? mergeBillColumnPrefs(template.columns)
      : base.columns;
  const columns = backfillHeaderSlots(rawColumns);

  return {
    moduleKey: template.moduleKey ?? base.moduleKey,
    viewContext: template.viewContext ?? base.viewContext,
    columns,
    lineColumnOrder: mergeFieldOrder(
      "lineColumnOrder" in template ? template.lineColumnOrder : undefined,
      BILL_LINE_COLUMN_IDS
    ),
    catalogLineFieldOrder: mergeCatalogLineFieldOrder(
      "catalogLineFieldOrder" in template ? template.catalogLineFieldOrder : undefined,
      DEFAULT_BILL_CATALOG_LINE_FIELD_ORDER
    ),
    headerFieldOrder: mergeFieldOrder(
      "headerFieldOrder" in template ? template.headerFieldOrder : undefined,
      BILL_HEADER_FIELD_IDS
    ),
    totalsFieldOrder: mergeFieldOrder(
      "totalsFieldOrder" in template ? template.totalsFieldOrder : undefined,
      BILL_TOTALS_FIELD_IDS
    ),
    imageDisplayMode:
      "imageDisplayMode" in template && template.imageDisplayMode
        ? template.imageDisplayMode
        : base.imageDisplayMode,
  };
}

export function isBillFormHeaderPlaceableField(fieldId: string): boolean {
  return (BILL_FORM_HEADER_PLACEABLE_FIELD_IDS as readonly string[]).includes(fieldId);
}

export function getBillLineSettingsColumnOrder(layout: DocumentLayoutTemplate): BillLineSettingsColumnId[] {
  const normalized = normalizeBillLayoutTemplate(layout);
  const settingsSet = new Set<string>(BILL_LINE_SETTINGS_COLUMN_IDS);
  return normalized.lineColumnOrder.filter((id): id is BillLineSettingsColumnId => settingsSet.has(id));
}

export function orderedBillLineColumns(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizeBillLayoutTemplate(layout);
  return normalized.lineColumnOrder
    .map((id) => getColumnPref(normalized, id))
    .filter(
      (column): column is DocumentColumnPref =>
        !!column && (BILL_LINE_COLUMN_IDS as readonly string[]).includes(column.id)
    );
}

export function orderedBillHeaderFields(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizeBillLayoutTemplate(layout);
  return normalized.headerFieldOrder
    .map((id) => getColumnPref(normalized, id))
    .filter(
      (column): column is DocumentColumnPref =>
        !!column && (BILL_HEADER_FIELD_IDS as readonly string[]).includes(column.id)
    );
}

export function orderedBillTotalsFields(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizeBillLayoutTemplate(layout);
  return normalized.totalsFieldOrder
    .map((id) => getColumnPref(normalized, id))
    .filter(
      (column): column is DocumentColumnPref =>
        !!column && (BILL_TOTALS_FIELD_IDS as readonly string[]).includes(column.id)
    );
}

export function orderedCatalogLineFields(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizeBillLayoutTemplate(layout);
  return normalized.catalogLineFieldOrder
    .map((id) => getColumnPref(normalized, id))
    .filter((column): column is DocumentColumnPref => !!column && isCatalogFieldId(column.id));
}

export function getVisibleBillLineColumns(
  layout: DocumentLayoutDefaults = DEFAULT_BILL_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedBillLineColumns(normalizeBillLayoutTemplate(layout)).filter((column) => column.defaultVisible);
}

export function getVisibleCatalogLineFields(
  layout: DocumentLayoutDefaults = DEFAULT_BILL_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedCatalogLineFields(normalizeBillLayoutTemplate(layout)).filter((column) => column.defaultVisible);
}

export function getVisibleHeaderFields(
  layout: DocumentLayoutTemplate = DEFAULT_BILL_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedBillHeaderFields(layout).filter((column) => column.defaultVisible);
}

export function getVisibleTotalsFields(
  layout: DocumentLayoutTemplate = DEFAULT_BILL_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedBillTotalsFields(layout).filter((column) => column.defaultVisible);
}

export function resolveLineFieldSlot(column: DocumentColumnPref): DocumentLineSlot {
  if (column.id === "item") return "column";
  if (column.lineSlot) return column.lineSlot;
  return "item_detail";
}

export function getColumnLineFields(
  layout: DocumentLayoutDefaults = DEFAULT_BILL_SCREEN_LAYOUT
): DocumentColumnPref[] {
  const visible = getVisibleBillLineColumns(layout);
  const columns = visible.filter((column) => resolveLineFieldSlot(column) === "column");
  const item = columns.find((column) => column.id === "item");
  const rest = columns.filter((column) => column.id !== "item");
  return item ? [item, ...rest] : rest;
}

export function getItemDetailLineFields(
  layout: DocumentLayoutDefaults = DEFAULT_BILL_SCREEN_LAYOUT
): DocumentColumnPref[] {
  const commercial = getVisibleBillLineColumns(layout).filter(
    (column) => resolveLineFieldSlot(column) === "item_detail"
  );
  const catalog = getVisibleCatalogLineFields(layout);
  return [...commercial, ...catalog];
}

export function getBillLineEntryTableColumns(
  layout: DocumentLayoutDefaults = DEFAULT_BILL_SCREEN_LAYOUT
): DocumentColumnPref[] {
  const normalized = normalizeBillLayoutTemplate(layout);
  const commercial = getColumnLineFields(normalized);
  if (normalized.imageDisplayMode !== "SEPARATE_COLUMN") return commercial;
  return [BILL_LINE_IMAGE_COLUMN, ...commercial];
}

export function getBillLayoutColumnPref(
  layout: DocumentLayoutDefaults,
  columnId: string
): DocumentColumnPref | undefined {
  return normalizeBillLayoutTemplate(layout).columns.find((column) => column.id === columnId);
}

export function patchBillLayoutColumn(
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

export function moveBillLineColumnOrder(
  layout: DocumentLayoutTemplate,
  fromId: BillLineColumnId,
  toId: BillLineColumnId
): DocumentLayoutTemplate {
  return {
    ...layout,
    lineColumnOrder: moveFieldInOrder(layout.lineColumnOrder, fromId, toId, { pinnedIds: ["item"] }),
  };
}

export function moveBillHeaderFieldOrder(
  layout: DocumentLayoutTemplate,
  fromId: BillHeaderFieldId,
  toId: BillHeaderFieldId
): DocumentLayoutTemplate {
  return {
    ...layout,
    headerFieldOrder: moveFieldInOrder(layout.headerFieldOrder, fromId, toId),
  };
}

export function moveBillTotalsFieldOrder(
  layout: DocumentLayoutTemplate,
  fromId: BillTotalsFieldId,
  toId: BillTotalsFieldId
): DocumentLayoutTemplate {
  return {
    ...layout,
    totalsFieldOrder: moveFieldInOrder(layout.totalsFieldOrder, fromId, toId, {
      pinnedIds: ["total_liability_amount"],
    }),
  };
}

export function createBillCatalogFieldPref(
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

export function addBillCatalogField(
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

export function removeBillCatalogField(
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

export function moveBillCatalogLineFieldOrder(
  layout: DocumentLayoutTemplate,
  fromId: string,
  toId: string
): DocumentLayoutTemplate {
  return {
    ...layout,
    catalogLineFieldOrder: moveFieldInOrder(layout.catalogLineFieldOrder, fromId, toId),
  };
}
