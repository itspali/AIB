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

/** Line grid column ids — includes Phase 3 discount columns (hidden by default). */
export const PO_LINE_COLUMN_IDS = [
  "item",
  "sku",
  "quantity_ordered",
  "unit",
  "unit_price",
  "mrp",
  "discount_pct",
  "discount_amount",
  "tax_rate_pct",
  "line_tax_amount",
  "cgst_amount",
  "sgst_amount",
  "igst_amount",
  "line_total",
] as const;

export type PoLineColumnId = (typeof PO_LINE_COLUMN_IDS)[number];

/** Line columns shown in layout settings (subline-only helpers excluded). */
export const PO_LINE_SETTINGS_COLUMN_IDS = [
  "item",
  "sku",
  "quantity_ordered",
  "unit",
  "unit_price",
  "mrp",
  "discount_pct",
  "line_tax_amount",
  "cgst_amount",
  "sgst_amount",
  "igst_amount",
  "line_total",
] as const satisfies readonly PoLineColumnId[];

export type PoLineSettingsColumnId = (typeof PO_LINE_SETTINGS_COLUMN_IDS)[number];

/** Internal line columns kept for subline rendering — not listed in settings. */
export const PO_LINE_INTERNAL_COLUMN_IDS = ["discount_amount", "tax_rate_pct"] as const;

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
  "tax_supply_nature",
  "currency",
  "voucher_number",
  "payment_terms_days",
  "requisition_number",
  "expected_delivery_date",
  "internal_notes",
  "document_status",
  "created_at",
  "created_by",
  "updated_at",
] as const;

export type PoHeaderFieldId = (typeof PO_HEADER_FIELD_IDS)[number];

/** Header fields rendered in the create/edit form top row (supplier block). */
export const PO_FORM_HEADER_PRIMARY_FIELD_IDS = [
  "destination",
  "supplier",
  "currency",
] as const satisfies readonly PoHeaderFieldId[];

export type PoFormHeaderPrimaryFieldId = (typeof PO_FORM_HEADER_PRIMARY_FIELD_IDS)[number];

/** Header fields rendered in the details rail / stacked panel. */
export const PO_FORM_HEADER_DETAILS_FIELD_IDS = [
  "tax_supply_nature",
  "payment_terms_days",
  "requisition_number",
  "expected_delivery_date",
  "internal_notes",
] as const satisfies readonly PoHeaderFieldId[];

export type PoFormHeaderDetailsFieldId = (typeof PO_FORM_HEADER_DETAILS_FIELD_IDS)[number];

/** Header fields that support primary/details placement in layout settings. */
export const PO_FORM_HEADER_PLACEABLE_FIELD_IDS = [
  ...PO_FORM_HEADER_PRIMARY_FIELD_IDS,
  ...PO_FORM_HEADER_DETAILS_FIELD_IDS,
] as const;

export type PoFormHeaderPlaceableFieldId = (typeof PO_FORM_HEADER_PLACEABLE_FIELD_IDS)[number];

export const PO_TOTALS_FIELD_IDS = [
  "line_count",
  "subtotal_ex_tax",
  "transaction_discount",
  "tax_amount",
  "shipping_amount",
  "shipping_tax_amount",
  "round_off_amount",
  "additional_charges_amount",
  "grand_total",
] as const;

/** Totals rows editable on the PO form (not computed from lines). */
export const PO_EDITABLE_TOTALS_FIELD_IDS = [
  "transaction_discount",
  "shipping_amount",
  "shipping_tax_amount",
  "round_off_amount",
  "additional_charges_amount",
] as const;

export type PoEditableTotalsFieldId = (typeof PO_EDITABLE_TOTALS_FIELD_IDS)[number];

/** Totals rows omitted from summary and layout settings. */
export const PO_TOTALS_INTERNAL_FIELD_IDS = ["line_count", "shipping_tax_rate_pct"] as const;

export type PoTotalsFieldId = (typeof PO_TOTALS_FIELD_IDS)[number];

/** Line columns introduced in Phase 3 — gated until shipped. */
export const PO_PHASE3_LINE_COLUMN_IDS = [] as const;

export function isPoPhase3LineColumn(_columnId: string): boolean {
  return false;
}

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
    label: "Offer price (ex tax)",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "mrp",
    label: "MRP",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "item_detail",
    showLabel: true,
    itemDetailFlow: "new_line",
  },
  {
    id: "discount_pct",
    label: "Discount",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "discount_amount",
    label: "Disc amount",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "tax_rate_pct",
    label: "Tax %",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "line_tax_amount",
    label: "Line tax",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "cgst_amount",
    label: "CGST",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "sgst_amount",
    label: "SGST",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "igst_amount",
    label: "IGST",
    defaultVisible: false,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
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
  {
    id: "supplier",
    label: "Supplier",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "primary",
  },
  {
    id: "destination",
    label: "Destination",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "primary",
  },
  {
    id: "tax_supply_nature",
    label: "Supply type",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "details",
  },
  {
    id: "currency",
    label: "Currency",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "primary",
  },
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
    headerSlot: "details",
  },
  {
    id: "requisition_number",
    label: "Requisition #",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "details",
  },
  {
    id: "expected_delivery_date",
    label: "Expected delivery",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "details",
  },
  {
    id: "internal_notes",
    label: "Internal notes",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "details",
  },
  {
    id: "document_status",
    label: "Status",
    defaultVisible: true,
    group: "header",
    align: "left",
  },
  {
    id: "created_at",
    label: "Created",
    defaultVisible: false,
    group: "header",
    align: "left",
  },
  {
    id: "created_by",
    label: "Created by",
    defaultVisible: false,
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
  { id: "line_count", label: "Lines", defaultVisible: false, group: "totals", align: "right" },
  {
    id: "subtotal_ex_tax",
    label: "Subtotal (ex tax)",
    defaultVisible: true,
    group: "totals",
    align: "right",
    decimalPlaces: 2,
  },
  {
    id: "transaction_discount",
    label: "Trade discount",
    defaultVisible: false,
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
    id: "shipping_amount",
    label: "Shipping",
    defaultVisible: false,
    group: "totals",
    align: "right",
    decimalPlaces: 2,
  },
  {
    id: "shipping_tax_rate_pct",
    label: "Shipping tax %",
    defaultVisible: false,
    group: "totals",
    align: "right",
    decimalPlaces: 2,
  },
  {
    id: "shipping_tax_amount",
    label: "Tax on shipping",
    defaultVisible: false,
    group: "totals",
    align: "right",
    decimalPlaces: 2,
  },
  {
    id: "round_off_amount",
    label: "Round off",
    defaultVisible: false,
    group: "totals",
    align: "right",
    decimalPlaces: 2,
  },
  {
    id: "additional_charges_amount",
    label: "Additional charges",
    defaultVisible: false,
    group: "totals",
    align: "right",
    decimalPlaces: 2,
  },
  {
    id: "grand_total",
    label: "Grand total",
    defaultVisible: true,
    group: "totals",
    align: "right",
    decimalPlaces: 2,
  },
];

const PO_TOTALS_CHARGE_FIELD_IDS = [
  "shipping_amount",
  "shipping_tax_amount",
  "round_off_amount",
  "additional_charges_amount",
] as const satisfies readonly PoTotalsFieldId[];

/** Ensures canonical commercial order and charge rows precede grand total. */
export function normalizeTotalsFieldOrder(order: readonly PoTotalsFieldId[]): PoTotalsFieldId[] {
  const chargeSet = new Set<string>(PO_TOTALS_CHARGE_FIELD_IDS);
  const withoutGrand = order.filter((id) => id !== "grand_total");
  const charges = PO_TOTALS_CHARGE_FIELD_IDS.filter((id) => withoutGrand.includes(id));
  const rest = withoutGrand.filter((id) => !chargeSet.has(id));

  const orderedRest: PoTotalsFieldId[] = [];
  const seen = new Set<string>();
  for (const id of PO_TOTALS_FIELD_IDS) {
    if (id === "grand_total" || chargeSet.has(id)) continue;
    if (rest.includes(id)) {
      orderedRest.push(id);
      seen.add(id);
    }
  }
  for (const id of rest) {
    if (!seen.has(id)) orderedRest.push(id);
  }

  return [...orderedRest, ...charges, "grand_total"];
}

export const DEFAULT_PO_LINE_COLUMN_ORDER: PoLineColumnId[] = [...PO_LINE_COLUMN_IDS];
export const DEFAULT_PO_LINE_SETTINGS_COLUMN_ORDER: PoLineSettingsColumnId[] = [
  ...PO_LINE_SETTINGS_COLUMN_IDS,
];
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

function backfillHeaderSlots(columns: DocumentColumnPref[]): DocumentColumnPref[] {
  return columns.map((column) => {
    if (column.group !== "header" || column.headerSlot) return column;
    if ((PO_FORM_HEADER_PRIMARY_FIELD_IDS as readonly string[]).includes(column.id)) {
      return { ...column, headerSlot: "primary" as const };
    }
    if ((PO_FORM_HEADER_DETAILS_FIELD_IDS as readonly string[]).includes(column.id)) {
      return { ...column, headerSlot: "details" as const };
    }
    return column;
  });
}

/** Fold standalone disc amount / tax % visibility into parent columns (legacy layouts). */
function foldLegacyLineColumnVisibility(columns: DocumentColumnPref[]): DocumentColumnPref[] {
  const discAmountVisible =
    columns.find((column) => column.id === "discount_amount")?.defaultVisible === true;
  const discPctVisible =
    columns.find((column) => column.id === "discount_pct")?.defaultVisible === true;
  const taxRateVisible =
    columns.find((column) => column.id === "tax_rate_pct")?.defaultVisible === true;
  const lineTaxVisible =
    columns.find((column) => column.id === "line_tax_amount")?.defaultVisible === true;

  const foldDiscAmount = discAmountVisible && !discPctVisible;
  const foldTaxRate = taxRateVisible && !lineTaxVisible;

  if (!foldDiscAmount && !foldTaxRate) return columns;

  return columns.map((column) => {
    if (foldDiscAmount && column.id === "discount_amount") {
      return { ...column, defaultVisible: false };
    }
    if (foldDiscAmount && column.id === "discount_pct") {
      return { ...column, defaultVisible: true };
    }
    if (foldTaxRate && column.id === "tax_rate_pct") {
      return { ...column, defaultVisible: false };
    }
    if (foldTaxRate && column.id === "line_tax_amount") {
      return { ...column, defaultVisible: true };
    }
    return column;
  });
}

export function resolveHeaderFieldSlot(column: DocumentColumnPref): DocumentHeaderSlot | null {
  if (column.headerSlot) return column.headerSlot;
  if ((PO_FORM_HEADER_PRIMARY_FIELD_IDS as readonly string[]).includes(column.id)) {
    return "primary";
  }
  if ((PO_FORM_HEADER_DETAILS_FIELD_IDS as readonly string[]).includes(column.id)) {
    return "details";
  }
  return null;
}

export function isPoFormHeaderPlaceableField(fieldId: string): boolean {
  return (PO_FORM_HEADER_PLACEABLE_FIELD_IDS as readonly string[]).includes(fieldId);
}

export function getPoLineSettingsColumnOrder(
  layout: DocumentLayoutTemplate
): PoLineSettingsColumnId[] {
  const normalized = normalizePoLayoutTemplate(layout);
  const settingsSet = new Set<string>(PO_LINE_SETTINGS_COLUMN_IDS);
  return normalized.lineColumnOrder.filter(
    (id): id is PoLineSettingsColumnId => settingsSet.has(id)
  );
}

export function normalizePoLayoutTemplate(
  template: Partial<DocumentLayoutTemplate> | DocumentLayoutDefaults
): DocumentLayoutTemplate {
  const base = DEFAULT_PO_SCREEN_LAYOUT;
  const rawColumns =
    template.columns && template.columns.length > 0
      ? mergePoColumnPrefs(template.columns)
      : base.columns;
  const columns = foldLegacyLineColumnVisibility(backfillHeaderSlots(rawColumns));

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
    totalsFieldOrder: normalizeTotalsFieldOrder(
      mergeFieldOrder(
        "totalsFieldOrder" in template ? template.totalsFieldOrder : undefined,
        PO_TOTALS_FIELD_IDS
      )
    ),
    imageDisplayMode:
      "imageDisplayMode" in template && template.imageDisplayMode
        ? template.imageDisplayMode
        : base.imageDisplayMode,
  };
}

/** Merge saved catalog field order — saved order is authoritative (supports remove/re-add). */
function mergeCatalogLineFieldOrder(
  saved: readonly string[] | undefined,
  registryIds: readonly string[]
): string[] {
  if (!saved || saved.length === 0) return [...registryIds];
  const registrySet = new Set(registryIds);
  return saved.filter((id) => registrySet.has(id) || isCatalogFieldId(id));
}

/** Merge saved prefs with registry defaults (new fields appended). */
export function mergePoColumnPrefs(saved: readonly DocumentColumnPref[]): DocumentColumnPref[] {
  const registry = DEFAULT_PO_SCREEN_LAYOUT.columns;
  const savedById = new Map(saved.map((column) => [column.id, column]));
  const merged: DocumentColumnPref[] = [];

  for (const registryColumn of registry) {
    const savedColumn = savedById.get(registryColumn.id);
    if (savedColumn) {
      const mergedColumn = { ...registryColumn, ...savedColumn, id: registryColumn.id };
      if (mergedColumn.id === "grand_total" && mergedColumn.label === "Total") {
        mergedColumn.label = registryColumn.label;
      }
      merged.push(mergedColumn);
      continue;
    }
    merged.push(registryColumn);
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
  if (!isCatalogFieldId(fieldId)) return layout;
  return {
    ...layout,
    catalogLineFieldOrder: layout.catalogLineFieldOrder.filter((id) => id !== fieldId),
    columns: layout.columns.filter((column) => column.id !== fieldId),
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
  const internalTotals = new Set<string>(PO_TOTALS_INTERNAL_FIELD_IDS);
  return normalized.totalsFieldOrder
    .map((id) => getColumnPref(normalized, id))
    .filter(
      (column): column is DocumentColumnPref =>
        !!column &&
        (PO_TOTALS_FIELD_IDS as readonly string[]).includes(column.id) &&
        !internalTotals.has(column.id)
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

export type PoLineColumnVisibilityOptions = {
  allowLineItemDiscounts?: boolean;
  enableMrpTradeTerms?: boolean;
};

/** Suppress MRP line fields when procurement MRP/trade terms policy is disabled. */
export function filterPoMrpTradeTermsLineFields(
  columns: DocumentColumnPref[],
  options?: Pick<PoLineColumnVisibilityOptions, "enableMrpTradeTerms">
): DocumentColumnPref[] {
  if (options?.enableMrpTradeTerms !== false) {
    return columns;
  }
  return columns.filter((column) => column.id !== "mrp");
}

/** Drawer line grid columns including optional image column. */
export function getPoLineEntryTableColumns(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT,
  options?: PoLineColumnVisibilityOptions
): DocumentColumnPref[] {
  const normalized = normalizePoLayoutTemplate(layout);
  let commercial = getColumnLineFields(normalized);
  if (options?.allowLineItemDiscounts === false) {
    commercial = commercial.filter(
      (column) => column.id !== "discount_pct" && column.id !== "discount_amount"
    );
  }
  commercial = filterPoMrpTradeTermsLineFields(commercial, options);
  if (normalized.imageDisplayMode !== "SEPARATE_COLUMN") {
    return commercial;
  }
  return [PO_LINE_IMAGE_COLUMN, ...commercial];
}

/** Visible line fields rendered under the item cell in compact drawer mode. */
export function getItemDetailLineFields(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT,
  options?: Pick<PoLineColumnVisibilityOptions, "enableMrpTradeTerms">
): DocumentColumnPref[] {
  const commercial = getVisiblePoLineColumns(layout).filter(
    (column) => resolveLineFieldSlot(column) === "item_detail"
  );
  const catalog = getVisibleCatalogLineFields(layout);
  return filterPoMrpTradeTermsLineFields([...commercial, ...catalog], options);
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
  const moved = movePoLayoutFieldOrder(layout, "totalsFieldOrder", fromId, toId, [
    "grand_total",
  ]);
  return {
    ...moved,
    totalsFieldOrder: normalizeTotalsFieldOrder(moved.totalsFieldOrder as PoTotalsFieldId[]),
  };
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
