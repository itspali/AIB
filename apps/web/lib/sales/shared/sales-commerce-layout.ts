import {
  buildCatalogFieldId,
  isCatalogFieldId,
  VARIANT_ATTRIBUTES_ALL_ID,
} from "@/lib/documents/catalog-field-ids";
import { mergeFieldOrder, moveFieldInOrder } from "@/lib/documents/layout-order";
import type {
  DocumentCatalogFieldSource,
  DocumentColumnPref,
  DocumentHeaderSlot,
  DocumentImageDisplayMode,
  DocumentLayoutDefaults,
  DocumentLayoutTemplate,
  DocumentLineSlot,
} from "@/lib/documents/types";

export type { DocumentLayoutDefaults };

export const SALES_LINE_COLUMN_IDS = [
  "item",
  "sku",
  "quantity_ordered",
  "unit",
  "unit_price",
  "discount_pct",
  "discount_amount",
  "tax_rate_pct",
  "line_tax_amount",
  "line_total",
] as const;

export type SalesLineColumnId = (typeof SALES_LINE_COLUMN_IDS)[number];

export const SALES_LINE_SETTINGS_COLUMN_IDS = [
  "item",
  "sku",
  "quantity_ordered",
  "unit",
  "unit_price",
  "discount_pct",
  "line_tax_amount",
  "line_total",
] as const satisfies readonly SalesLineColumnId[];

export type SalesLineSettingsColumnId = (typeof SALES_LINE_SETTINGS_COLUMN_IDS)[number];

export const SALES_LINE_INTERNAL_COLUMN_IDS = ["discount_amount", "tax_rate_pct"] as const;

/** Synthetic grid column when imageDisplayMode is SEPARATE_COLUMN. */
export const SALES_LINE_IMAGE_COLUMN_ID = "line_image";

const SALES_LINE_IMAGE_COLUMN: DocumentColumnPref = {
  id: SALES_LINE_IMAGE_COLUMN_ID,
  label: "",
  defaultVisible: true,
  group: "line",
  align: "center",
};

export const SALES_COMPACT_PRIMARY_LINE_COLUMN_IDS = [
  "item",
  "quantity_ordered",
  "unit_price",
  "line_total",
] as const satisfies readonly SalesLineColumnId[];

export const SALES_HEADER_FIELD_IDS = [
  "customer",
  "shipping_location",
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

export type SalesHeaderFieldId = (typeof SALES_HEADER_FIELD_IDS)[number];

export const SALES_FORM_HEADER_PRIMARY_FIELD_IDS = [
  "customer",
  "shipping_location",
  "currency",
] as const satisfies readonly SalesHeaderFieldId[];

export type SalesFormHeaderPrimaryFieldId = (typeof SALES_FORM_HEADER_PRIMARY_FIELD_IDS)[number];

export const SALES_FORM_HEADER_DETAILS_FIELD_IDS = [
  "tax_supply_nature",
  "payment_terms_days",
  "requisition_number",
  "expected_delivery_date",
  "internal_notes",
] as const satisfies readonly SalesHeaderFieldId[];

export type SalesFormHeaderDetailsFieldId = (typeof SALES_FORM_HEADER_DETAILS_FIELD_IDS)[number];

export const SALES_FORM_HEADER_PLACEABLE_FIELD_IDS = [
  ...SALES_FORM_HEADER_PRIMARY_FIELD_IDS,
  ...SALES_FORM_HEADER_DETAILS_FIELD_IDS,
] as const;

export type SalesFormHeaderPlaceableFieldId = (typeof SALES_FORM_HEADER_PLACEABLE_FIELD_IDS)[number];

export const SALES_TOTALS_FIELD_IDS = [
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

export const SALES_EDITABLE_TOTALS_FIELD_IDS = [
  "transaction_discount",
  "shipping_amount",
  "shipping_tax_amount",
  "round_off_amount",
  "additional_charges_amount",
] as const;

export type SalesEditableTotalsFieldId = (typeof SALES_EDITABLE_TOTALS_FIELD_IDS)[number];

export const SALES_TOTALS_INTERNAL_FIELD_IDS = ["line_count", "shipping_tax_rate_pct"] as const;

export type SalesTotalsFieldId = (typeof SALES_TOTALS_FIELD_IDS)[number];

const SALES_LINE_COLUMNS: DocumentColumnPref[] = [
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
    label: "Unit rate (ex tax)",
    defaultVisible: true,
    group: "line",
    align: "right",
    decimalPlaces: 2,
    lineSlot: "column",
  },
  {
    id: "discount_pct",
    label: "Discount",
    defaultVisible: true,
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
    label: "Tax",
    defaultVisible: true,
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

const SALES_CATALOG_LINE_COLUMNS: DocumentColumnPref[] = [
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
];

const SALES_HEADER_COLUMNS: DocumentColumnPref[] = [
  {
    id: "customer",
    label: "Customer",
    defaultVisible: true,
    group: "header",
    align: "left",
    headerSlot: "primary",
  },
  {
    id: "shipping_location",
    label: "Ship from",
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
    label: "Document number",
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
    label: "Delivery date",
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

const SALES_TOTALS_COLUMNS: DocumentColumnPref[] = [
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

const SALES_TOTALS_CHARGE_FIELD_IDS = [
  "shipping_amount",
  "shipping_tax_amount",
  "round_off_amount",
  "additional_charges_amount",
] as const satisfies readonly SalesTotalsFieldId[];

export function normalizeSalesTotalsFieldOrder(order: readonly SalesTotalsFieldId[]): SalesTotalsFieldId[] {
  const chargeSet = new Set<string>(SALES_TOTALS_CHARGE_FIELD_IDS);
  const withoutGrand = order.filter((id) => id !== "grand_total");
  const charges = SALES_TOTALS_CHARGE_FIELD_IDS.filter((id) => withoutGrand.includes(id));
  const rest = withoutGrand.filter((id) => !chargeSet.has(id));

  const orderedRest: SalesTotalsFieldId[] = [];
  const seen = new Set<string>();
  for (const id of SALES_TOTALS_FIELD_IDS) {
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

export const DEFAULT_SALES_LINE_COLUMN_ORDER: SalesLineColumnId[] = [...SALES_LINE_COLUMN_IDS];
export const DEFAULT_SALES_LINE_SETTINGS_COLUMN_ORDER: SalesLineSettingsColumnId[] = [
  ...SALES_LINE_SETTINGS_COLUMN_IDS,
];
export const DEFAULT_SALES_HEADER_FIELD_ORDER: SalesHeaderFieldId[] = [...SALES_HEADER_FIELD_IDS];
export const DEFAULT_SALES_TOTALS_FIELD_ORDER: SalesTotalsFieldId[] = [...SALES_TOTALS_FIELD_IDS];
export const DEFAULT_SALES_CATALOG_LINE_FIELD_ORDER: string[] = SALES_CATALOG_LINE_COLUMNS.map(
  (column) => column.id
);

function createSalesScreenLayout(
  moduleKey: DocumentLayoutTemplate["moduleKey"]
): DocumentLayoutTemplate {
  return {
    moduleKey,
    viewContext: "SCREEN_GRID",
    columns: [
      ...SALES_LINE_COLUMNS,
      ...SALES_CATALOG_LINE_COLUMNS,
      ...SALES_HEADER_COLUMNS,
      ...SALES_TOTALS_COLUMNS,
    ],
    lineColumnOrder: [...DEFAULT_SALES_LINE_COLUMN_ORDER],
    catalogLineFieldOrder: [...DEFAULT_SALES_CATALOG_LINE_FIELD_ORDER],
    headerFieldOrder: [...DEFAULT_SALES_HEADER_FIELD_ORDER],
    totalsFieldOrder: [...DEFAULT_SALES_TOTALS_FIELD_ORDER],
    imageDisplayMode: "HIDDEN",
  };
}

export const DEFAULT_SALES_ORDER_SCREEN_LAYOUT = createSalesScreenLayout("SALES_ORDER");
export const DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT = createSalesScreenLayout("SALES_QUOTATION");
export const DEFAULT_SALES_INVOICE_SCREEN_LAYOUT = createSalesScreenLayout("SALES_INVOICE");

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
    if ((SALES_FORM_HEADER_PRIMARY_FIELD_IDS as readonly string[]).includes(column.id)) {
      return { ...column, headerSlot: "primary" as const };
    }
    if ((SALES_FORM_HEADER_DETAILS_FIELD_IDS as readonly string[]).includes(column.id)) {
      return { ...column, headerSlot: "details" as const };
    }
    return column;
  });
}

export function resolveSalesHeaderFieldSlot(column: DocumentColumnPref): DocumentHeaderSlot | null {
  if (column.headerSlot) return column.headerSlot;
  if ((SALES_FORM_HEADER_PRIMARY_FIELD_IDS as readonly string[]).includes(column.id)) {
    return "primary";
  }
  if ((SALES_FORM_HEADER_DETAILS_FIELD_IDS as readonly string[]).includes(column.id)) {
    return "details";
  }
  return null;
}

export function isSalesFormHeaderPlaceableField(fieldId: string): boolean {
  return (SALES_FORM_HEADER_PLACEABLE_FIELD_IDS as readonly string[]).includes(fieldId);
}

export function mergeSalesColumnPrefs(saved: readonly DocumentColumnPref[]): DocumentColumnPref[] {
  const registry = DEFAULT_SALES_ORDER_SCREEN_LAYOUT.columns;
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

/** Merge saved catalog field order — saved order is authoritative (supports remove/re-add). */
function mergeCatalogLineFieldOrder(
  saved: readonly string[] | undefined,
  registryIds: readonly string[]
): string[] {
  if (!saved || saved.length === 0) return [...registryIds];
  const registrySet = new Set(registryIds);
  return saved.filter((id) => registrySet.has(id) || isCatalogFieldId(id));
}

export function normalizeSalesCommerceLayoutTemplate(
  template: Partial<DocumentLayoutTemplate> | DocumentLayoutDefaults,
  fallback: DocumentLayoutTemplate = DEFAULT_SALES_ORDER_SCREEN_LAYOUT
): DocumentLayoutTemplate {
  const base = fallback;
  const rawColumns =
    template.columns && template.columns.length > 0
      ? mergeSalesColumnPrefs(template.columns)
      : base.columns;
  const columns = backfillHeaderSlots(foldLegacySalesLineColumnVisibility(rawColumns));

  return {
    moduleKey: template.moduleKey ?? base.moduleKey,
    viewContext: template.viewContext ?? base.viewContext,
    columns,
    lineColumnOrder: mergeFieldOrder(
      "lineColumnOrder" in template ? template.lineColumnOrder : undefined,
      SALES_LINE_COLUMN_IDS
    ),
    catalogLineFieldOrder: mergeCatalogLineFieldOrder(
      "catalogLineFieldOrder" in template ? template.catalogLineFieldOrder : undefined,
      DEFAULT_SALES_CATALOG_LINE_FIELD_ORDER
    ),
    headerFieldOrder: mergeFieldOrder(
      "headerFieldOrder" in template ? template.headerFieldOrder : undefined,
      SALES_HEADER_FIELD_IDS
    ),
    totalsFieldOrder: normalizeSalesTotalsFieldOrder(
      mergeFieldOrder(
        "totalsFieldOrder" in template ? template.totalsFieldOrder : undefined,
        SALES_TOTALS_FIELD_IDS
      ) as SalesTotalsFieldId[]
    ),
    imageDisplayMode:
      "imageDisplayMode" in template && template.imageDisplayMode
        ? template.imageDisplayMode
        : base.imageDisplayMode,
  };
}

export function normalizeSalesOrderLayoutTemplate(
  template: Partial<DocumentLayoutTemplate> | DocumentLayoutDefaults
): DocumentLayoutTemplate {
  return normalizeSalesCommerceLayoutTemplate(template, DEFAULT_SALES_ORDER_SCREEN_LAYOUT);
}

export function normalizeSalesQuotationLayoutTemplate(
  template: Partial<DocumentLayoutTemplate> | DocumentLayoutDefaults
): DocumentLayoutTemplate {
  return normalizeSalesCommerceLayoutTemplate(template, DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT);
}

export function normalizeSalesInvoiceLayoutTemplate(
  template: Partial<DocumentLayoutTemplate> | DocumentLayoutDefaults
): DocumentLayoutTemplate {
  return normalizeSalesCommerceLayoutTemplate(template, DEFAULT_SALES_INVOICE_SCREEN_LAYOUT);
}

export function getSalesLineSettingsColumnOrder(
  layout: DocumentLayoutTemplate
): SalesLineSettingsColumnId[] {
  const normalized = normalizeSalesCommerceLayoutTemplate(layout);
  const settingsSet = new Set<string>(SALES_LINE_SETTINGS_COLUMN_IDS);
  return normalized.lineColumnOrder.filter(
    (id): id is SalesLineSettingsColumnId => settingsSet.has(id)
  );
}

export function orderedSalesLineColumns(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizeSalesCommerceLayoutTemplate(layout);
  return normalized.lineColumnOrder
    .map((id) => getColumnPref(normalized, id))
    .filter(
      (column): column is DocumentColumnPref =>
        !!column && (SALES_LINE_COLUMN_IDS as readonly string[]).includes(column.id)
    );
}

export function orderedSalesHeaderFields(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizeSalesCommerceLayoutTemplate(layout);
  return normalized.headerFieldOrder
    .map((id) => getColumnPref(normalized, id))
    .filter(
      (column): column is DocumentColumnPref =>
        !!column && (SALES_HEADER_FIELD_IDS as readonly string[]).includes(column.id)
    );
}

export function orderedSalesTotalsFields(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizeSalesCommerceLayoutTemplate(layout);
  const internalTotals = new Set<string>(SALES_TOTALS_INTERNAL_FIELD_IDS);
  return normalized.totalsFieldOrder
    .map((id) => getColumnPref(normalized, id))
    .filter(
      (column): column is DocumentColumnPref =>
        !!column &&
        (SALES_TOTALS_FIELD_IDS as readonly string[]).includes(column.id) &&
        !internalTotals.has(column.id)
    );
}

export function getSalesLayoutColumnPref(
  layout: DocumentLayoutDefaults,
  columnId: string
): DocumentColumnPref | undefined {
  return normalizeSalesCommerceLayoutTemplate(layout).columns.find((column) => column.id === columnId);
}

export function resolveSalesLineFieldSlot(column: DocumentColumnPref): DocumentLineSlot {
  if (column.id === "item") return "column";
  if (column.lineSlot) return column.lineSlot;
  return (SALES_COMPACT_PRIMARY_LINE_COLUMN_IDS as readonly string[]).includes(column.id)
    ? "column"
    : "item_detail";
}

export function getVisibleSalesLineColumns(
  layout: DocumentLayoutDefaults = DEFAULT_SALES_ORDER_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedSalesLineColumns(normalizeSalesCommerceLayoutTemplate(layout)).filter(
    (column) => column.defaultVisible
  );
}

export function getColumnSalesLineFields(
  layout: DocumentLayoutDefaults = DEFAULT_SALES_ORDER_SCREEN_LAYOUT
): DocumentColumnPref[] {
  const visible = getVisibleSalesLineColumns(layout);
  const columns = visible.filter((column) => resolveSalesLineFieldSlot(column) === "column");
  const item = columns.find((column) => column.id === "item");
  const rest = columns.filter((column) => column.id !== "item");
  return item ? [item, ...rest] : rest;
}

export type SalesLineColumnVisibilityOptions = {
  allowLineItemDiscounts?: boolean;
};

export function resolveSalesLineImageDisplayMode(
  layout: DocumentLayoutDefaults = DEFAULT_SALES_ORDER_SCREEN_LAYOUT
): DocumentImageDisplayMode {
  return normalizeSalesCommerceLayoutTemplate(layout).imageDisplayMode;
}

export function shouldShowSalesLineInlineImage(mode: DocumentImageDisplayMode): boolean {
  return mode === "INLINE_CELL";
}

export function shouldShowSalesLineImageColumn(mode: DocumentImageDisplayMode): boolean {
  return mode === "SEPARATE_COLUMN";
}

function foldLegacySalesLineColumnVisibility(columns: DocumentColumnPref[]): DocumentColumnPref[] {
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

export function ensureSalesCommerceDrawerLineColumns(
  columns: DocumentColumnPref[],
  layout: DocumentLayoutTemplate,
  options?: SalesLineColumnVisibilityOptions
): DocumentColumnPref[] {
  const normalized = normalizeSalesCommerceLayoutTemplate(layout);
  const present = new Set(columns.map((column) => column.id));
  const requiredIds: SalesLineColumnId[] = [];

  if (!present.has("line_tax_amount")) {
    requiredIds.push("line_tax_amount");
  }
  if (options?.allowLineItemDiscounts !== false && !present.has("discount_pct")) {
    requiredIds.push("discount_pct");
  }

  if (requiredIds.length === 0) return columns;

  const toInsert = requiredIds
    .map((id) => getSalesLayoutColumnPref(normalized, id))
    .filter((column): column is DocumentColumnPref => Boolean(column))
    .map((column) => ({ ...column, defaultVisible: true, lineSlot: "column" as const }));

  const lineTotalIdx = columns.findIndex((column) => column.id === "line_total");
  if (lineTotalIdx < 0) return [...columns, ...toInsert];

  return [
    ...columns.slice(0, lineTotalIdx),
    ...toInsert,
    ...columns.slice(lineTotalIdx),
  ];
}

export function getSalesLineEntryTableColumns(
  layout: DocumentLayoutDefaults = DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  options?: SalesLineColumnVisibilityOptions
): DocumentColumnPref[] {
  const normalized = normalizeSalesCommerceLayoutTemplate(layout);
  let commercial = getColumnSalesLineFields(normalized);
  if (options?.allowLineItemDiscounts === false) {
    commercial = commercial.filter(
      (column) => column.id !== "discount_pct" && column.id !== "discount_amount"
    );
  }
  commercial = ensureSalesCommerceDrawerLineColumns(commercial, normalized, options);
  if (normalized.imageDisplayMode !== "SEPARATE_COLUMN") {
    return commercial;
  }
  return [SALES_LINE_IMAGE_COLUMN, ...commercial];
}

export function orderedSalesCatalogLineFields(layout: DocumentLayoutTemplate): DocumentColumnPref[] {
  const normalized = normalizeSalesCommerceLayoutTemplate(layout);
  return normalized.catalogLineFieldOrder
    .map((id) => getColumnPref(normalized, id))
    .filter((column): column is DocumentColumnPref => !!column && isCatalogFieldId(column.id));
}

export function getVisibleSalesCatalogLineFields(
  layout: DocumentLayoutDefaults = DEFAULT_SALES_ORDER_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedSalesCatalogLineFields(normalizeSalesCommerceLayoutTemplate(layout)).filter(
    (column) => column.defaultVisible
  );
}

export function createSalesCatalogFieldPref(
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

export function addSalesCatalogField(
  layout: DocumentLayoutTemplate,
  pref: DocumentColumnPref
): DocumentLayoutTemplate {
  const columns = layout.columns.some((column) => column.id === pref.id)
    ? layout.columns
    : [...layout.columns, pref];
  return {
    ...layout,
    columns,
    catalogLineFieldOrder: layout.catalogLineFieldOrder.includes(pref.id)
      ? layout.catalogLineFieldOrder
      : [...layout.catalogLineFieldOrder, pref.id],
  };
}

export function removeSalesCatalogField(
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

export function moveSalesCatalogLineFieldOrder(
  layout: DocumentLayoutTemplate,
  fromId: string,
  toId: string
): DocumentLayoutTemplate {
  return {
    ...layout,
    catalogLineFieldOrder: moveFieldInOrder(layout.catalogLineFieldOrder, fromId, toId),
  };
}

/** Visible line fields rendered under the item cell in compact drawer mode. */
export function getSalesItemDetailLineFields(
  layout: DocumentLayoutDefaults = DEFAULT_SALES_ORDER_SCREEN_LAYOUT
): DocumentColumnPref[] {
  const commercial = getVisibleSalesLineColumns(layout).filter(
    (column) => resolveSalesLineFieldSlot(column) === "item_detail"
  );
  const catalog = getVisibleSalesCatalogLineFields(layout);
  return [...commercial, ...catalog];
}

export function getVisibleSalesHeaderFields(
  layout: DocumentLayoutTemplate = DEFAULT_SALES_ORDER_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedSalesHeaderFields(layout).filter((column) => column.defaultVisible);
}

export function getVisibleSalesTotalsFields(
  layout: DocumentLayoutTemplate = DEFAULT_SALES_ORDER_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return orderedSalesTotalsFields(layout).filter((column) => column.defaultVisible);
}

export function patchSalesLayoutColumn(
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

export function moveSalesLineColumnOrder(
  layout: DocumentLayoutTemplate,
  fromId: SalesLineColumnId,
  toId: SalesLineColumnId
): DocumentLayoutTemplate {
  return moveSalesLayoutFieldOrder(layout, "lineColumnOrder", fromId, toId, ["item"]);
}

export function moveSalesHeaderFieldOrder(
  layout: DocumentLayoutTemplate,
  fromId: SalesHeaderFieldId,
  toId: SalesHeaderFieldId
): DocumentLayoutTemplate {
  return moveSalesLayoutFieldOrder(layout, "headerFieldOrder", fromId, toId);
}

export function moveSalesTotalsFieldOrder(
  layout: DocumentLayoutTemplate,
  fromId: SalesTotalsFieldId,
  toId: SalesTotalsFieldId
): DocumentLayoutTemplate {
  const moved = moveSalesLayoutFieldOrder(layout, "totalsFieldOrder", fromId, toId, ["grand_total"]);
  return {
    ...moved,
    totalsFieldOrder: normalizeSalesTotalsFieldOrder(moved.totalsFieldOrder as SalesTotalsFieldId[]),
  };
}

function moveSalesLayoutFieldOrder<TId extends string>(
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
