import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";

const STUB_LINE_COLUMNS: DocumentColumnPref[] = [
  {
    id: "item",
    label: "Item",
    defaultVisible: true,
    group: "line",
    align: "left",
    lineSlot: "column",
  },
  {
    id: "quantity",
    label: "Qty",
    defaultVisible: true,
    group: "line",
    align: "right",
    lineSlot: "column",
  },
  {
    id: "unit_price",
    label: "Rate",
    defaultVisible: true,
    group: "line",
    align: "right",
    lineSlot: "column",
  },
  {
    id: "line_total",
    label: "Total",
    defaultVisible: true,
    group: "line",
    align: "right",
    lineSlot: "column",
  },
];

const STUB_HEADER_COLUMNS: DocumentColumnPref[] = [
  {
    id: "customer",
    label: "Customer",
    defaultVisible: true,
    group: "header",
    headerSlot: "primary",
  },
  {
    id: "voucher_number",
    label: "Number",
    defaultVisible: true,
    group: "header",
    headerSlot: "details",
  },
  {
    id: "document_date",
    label: "Date",
    defaultVisible: true,
    group: "header",
    headerSlot: "details",
  },
];

function createStubLayout(moduleKey: DocumentLayoutTemplate["moduleKey"]): DocumentLayoutTemplate {
  const columns = [...STUB_HEADER_COLUMNS, ...STUB_LINE_COLUMNS];
  return {
    moduleKey,
    viewContext: "SCREEN_GRID",
    columns,
    lineColumnOrder: STUB_LINE_COLUMNS.map((column) => column.id),
    catalogLineFieldOrder: [],
    headerFieldOrder: STUB_HEADER_COLUMNS.map((column) => column.id),
    totalsFieldOrder: [],
    imageDisplayMode: "HIDDEN",
  };
}

export const DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT = createStubLayout("SALES_QUOTATION");
export const DEFAULT_SALES_ORDER_SCREEN_LAYOUT = createStubLayout("SALES_ORDER");
export const DEFAULT_SALES_INVOICE_SCREEN_LAYOUT = createStubLayout("SALES_INVOICE");

function normalizeStubLayout(
  template: Partial<DocumentLayoutTemplate>,
  fallback: DocumentLayoutTemplate
): DocumentLayoutTemplate {
  return {
    ...fallback,
    ...template,
    moduleKey: fallback.moduleKey,
    viewContext: template.viewContext ?? fallback.viewContext,
    columns: template.columns?.length ? template.columns : fallback.columns,
    lineColumnOrder: template.lineColumnOrder?.length
      ? template.lineColumnOrder
      : fallback.lineColumnOrder,
    catalogLineFieldOrder: template.catalogLineFieldOrder ?? fallback.catalogLineFieldOrder,
    headerFieldOrder: template.headerFieldOrder?.length
      ? template.headerFieldOrder
      : fallback.headerFieldOrder,
    totalsFieldOrder: template.totalsFieldOrder ?? fallback.totalsFieldOrder,
    imageDisplayMode: template.imageDisplayMode ?? fallback.imageDisplayMode,
  };
}

export function normalizeSalesQuotationLayoutTemplate(
  template: Partial<DocumentLayoutTemplate>
): DocumentLayoutTemplate {
  return normalizeStubLayout(template, DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT);
}

export function normalizeSalesOrderLayoutTemplate(
  template: Partial<DocumentLayoutTemplate>
): DocumentLayoutTemplate {
  return normalizeStubLayout(template, DEFAULT_SALES_ORDER_SCREEN_LAYOUT);
}

export function normalizeSalesInvoiceLayoutTemplate(
  template: Partial<DocumentLayoutTemplate>
): DocumentLayoutTemplate {
  return normalizeStubLayout(template, DEFAULT_SALES_INVOICE_SCREEN_LAYOUT);
}

function patchStubColumn(
  layout: DocumentLayoutTemplate,
  columnId: string,
  patch: Partial<DocumentColumnPref>
): DocumentLayoutTemplate {
  return {
    ...layout,
    columns: layout.columns.map((column) =>
      column.id === columnId ? { ...column, ...patch } : column
    ),
  };
}

function moveStubOrder(order: string[], fromId: string, toId: string): string[] {
  const next = [...order];
  const fromIndex = next.indexOf(fromId);
  const toIndex = next.indexOf(toId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return order;
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, fromId);
  return next;
}

function createStubAdapterHelpers(fallback: DocumentLayoutTemplate) {
  return {
    normalize: (template: Partial<DocumentLayoutTemplate>) => normalizeStubLayout(template, fallback),
    patchColumn: (
      layout: DocumentLayoutTemplate,
      columnId: string,
      patch: Partial<DocumentColumnPref>
    ) => patchStubColumn(layout, columnId, patch),
    getLineSettingsColumnOrder: (layout: DocumentLayoutTemplate) => layout.lineColumnOrder,
    isFormHeaderPlaceableField: (fieldId: string) =>
      fallback.headerFieldOrder.includes(fieldId),
    moveHeaderFieldOrder: (layout: DocumentLayoutTemplate, fromId: string, toId: string) => ({
      ...layout,
      headerFieldOrder: moveStubOrder(layout.headerFieldOrder, fromId, toId),
    }),
    moveLineColumnOrder: (layout: DocumentLayoutTemplate, fromId: string, toId: string) => ({
      ...layout,
      lineColumnOrder: moveStubOrder(layout.lineColumnOrder, fromId, toId),
    }),
    catalog: {
      add: (layout: DocumentLayoutTemplate) => layout,
      createPref: (
        _source: DocumentColumnPref["catalogSource"],
        key: string,
        label?: string
      ): DocumentColumnPref => ({
        id: key,
        label: label ?? key,
        defaultVisible: false,
        group: "catalog",
      }),
      move: (layout: DocumentLayoutTemplate) => layout,
      remove: (layout: DocumentLayoutTemplate) => layout,
    },
  };
}

export const SALES_QUOTATION_LAYOUT_STUB = createStubAdapterHelpers(DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT);
export const SALES_ORDER_LAYOUT_STUB = createStubAdapterHelpers(DEFAULT_SALES_ORDER_SCREEN_LAYOUT);
export const SALES_INVOICE_LAYOUT_STUB = createStubAdapterHelpers(DEFAULT_SALES_INVOICE_SCREEN_LAYOUT);
