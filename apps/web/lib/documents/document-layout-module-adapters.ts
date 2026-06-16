import type { DocumentColumnPref, DocumentLayoutTemplate } from "@/lib/documents/types";
import {
  addBillCatalogField,
  createBillCatalogFieldPref,
  DEFAULT_BILL_SCREEN_LAYOUT,
  getBillLineSettingsColumnOrder,
  isBillFormHeaderPlaceableField,
  moveBillCatalogLineFieldOrder,
  moveBillHeaderFieldOrder,
  moveBillLineColumnOrder,
  moveBillTotalsFieldOrder,
  normalizeBillLayoutTemplate,
  patchBillLayoutColumn,
  removeBillCatalogField,
  BILL_TOTALS_INTERNAL_FIELD_IDS,
  type BillHeaderFieldId,
  type BillLineSettingsColumnId,
  type BillTotalsFieldId,
} from "@/lib/documents/purchase-invoice-layout";
import {
  addGrnCatalogField,
  createGrnCatalogFieldPref,
  DEFAULT_GRN_SCREEN_LAYOUT,
  getGrnLineSettingsColumnOrder,
  isGrnFormHeaderPlaceableField,
  moveGrnCatalogLineFieldOrder,
  moveGrnHeaderFieldOrder,
  moveGrnLineColumnOrder,
  normalizeGrnLayoutTemplate,
  patchGrnLayoutColumn,
  removeGrnCatalogField,
  type GrnHeaderFieldId,
  type GrnLineSettingsColumnId,
} from "@/lib/documents/goods-receipt-layout";
import {
  addPoCatalogField,
  createPoCatalogFieldPref,
  DEFAULT_PO_SCREEN_LAYOUT,
  getPoLineSettingsColumnOrder,
  isPoFormHeaderPlaceableField,
  movePoCatalogLineFieldOrder,
  movePoHeaderFieldOrder,
  movePoLineColumnOrder,
  movePoTotalsFieldOrder,
  normalizePoLayoutTemplate,
  patchPoLayoutColumn,
  removePoCatalogField,
  PO_TOTALS_INTERNAL_FIELD_IDS,
  type PoHeaderFieldId,
  type PoLineSettingsColumnId,
  type PoTotalsFieldId,
} from "@/lib/documents/purchase-order-layout";
import {
  addSalesCatalogField,
  createSalesCatalogFieldPref,
  DEFAULT_SALES_INVOICE_SCREEN_LAYOUT,
  DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT,
  getSalesLineSettingsColumnOrder,
  isSalesFormHeaderPlaceableField,
  moveSalesCatalogLineFieldOrder,
  moveSalesHeaderFieldOrder,
  moveSalesLineColumnOrder,
  moveSalesTotalsFieldOrder,
  normalizeSalesInvoiceLayoutTemplate,
  normalizeSalesOrderLayoutTemplate,
  normalizeSalesQuotationLayoutTemplate,
  patchSalesLayoutColumn,
  removeSalesCatalogField,
  SALES_TOTALS_INTERNAL_FIELD_IDS,
  type SalesHeaderFieldId,
  type SalesLineSettingsColumnId,
  type SalesTotalsFieldId,
} from "@/lib/sales/shared/sales-commerce-layout";
import type { DocumentCatalogFieldSource, DocumentModuleKey } from "@/lib/documents/types";

export type DocumentLayoutModuleAdapter = {
  moduleKey: DocumentModuleKey;
  label: string;
  defaultLayout: DocumentLayoutTemplate;
  normalize: (template: Partial<DocumentLayoutTemplate>) => DocumentLayoutTemplate;
  patchColumn: (
    layout: DocumentLayoutTemplate,
    columnId: string,
    patch: Partial<DocumentColumnPref>
  ) => DocumentLayoutTemplate;
  getLineSettingsColumnOrder: (layout: DocumentLayoutTemplate) => string[];
  isFormHeaderPlaceableField: (fieldId: string) => boolean;
  moveHeaderFieldOrder: (
    layout: DocumentLayoutTemplate,
    fromId: string,
    toId: string
  ) => DocumentLayoutTemplate;
  moveLineColumnOrder: (
    layout: DocumentLayoutTemplate,
    fromId: string,
    toId: string
  ) => DocumentLayoutTemplate;
  moveTotalsFieldOrder?: (
    layout: DocumentLayoutTemplate,
    fromId: string,
    toId: string
  ) => DocumentLayoutTemplate;
  totalsInternalFieldIds: readonly string[];
  showTotalsSection: boolean;
  showImageSection: boolean;
  showCatalogSection: boolean;
  catalog: {
    add: (layout: DocumentLayoutTemplate, pref: DocumentColumnPref) => DocumentLayoutTemplate;
    createPref: (source: DocumentCatalogFieldSource, key: string, label?: string) => DocumentColumnPref;
    move: (layout: DocumentLayoutTemplate, fromId: string, toId: string) => DocumentLayoutTemplate;
    remove: (layout: DocumentLayoutTemplate, fieldId: string) => DocumentLayoutTemplate;
  };
};

export const PURCHASE_ORDER_LAYOUT_ADAPTER: DocumentLayoutModuleAdapter = {
  moduleKey: "PURCHASE_ORDER",
  label: "Purchase order",
  defaultLayout: DEFAULT_PO_SCREEN_LAYOUT,
  normalize: normalizePoLayoutTemplate,
  patchColumn: patchPoLayoutColumn,
  getLineSettingsColumnOrder: (layout) => getPoLineSettingsColumnOrder(layout),
  isFormHeaderPlaceableField: isPoFormHeaderPlaceableField,
  moveHeaderFieldOrder: (layout, fromId, toId) =>
    movePoHeaderFieldOrder(layout, fromId as PoHeaderFieldId, toId as PoHeaderFieldId),
  moveLineColumnOrder: (layout, fromId, toId) =>
    movePoLineColumnOrder(layout, fromId as PoLineSettingsColumnId, toId as PoLineSettingsColumnId),
  moveTotalsFieldOrder: (layout, fromId, toId) =>
    movePoTotalsFieldOrder(layout, fromId as PoTotalsFieldId, toId as PoTotalsFieldId),
  totalsInternalFieldIds: PO_TOTALS_INTERNAL_FIELD_IDS,
  showTotalsSection: true,
  showImageSection: true,
  showCatalogSection: true,
  catalog: {
    add: addPoCatalogField,
    createPref: createPoCatalogFieldPref,
    move: movePoCatalogLineFieldOrder,
    remove: removePoCatalogField,
  },
};

export const GOODS_RECEIPT_LAYOUT_ADAPTER: DocumentLayoutModuleAdapter = {
  moduleKey: "GOODS_RECEIPT_NOTE",
  label: "Goods receipt",
  defaultLayout: DEFAULT_GRN_SCREEN_LAYOUT,
  normalize: normalizeGrnLayoutTemplate,
  patchColumn: patchGrnLayoutColumn,
  getLineSettingsColumnOrder: (layout) => getGrnLineSettingsColumnOrder(layout),
  isFormHeaderPlaceableField: isGrnFormHeaderPlaceableField,
  moveHeaderFieldOrder: (layout, fromId, toId) =>
    moveGrnHeaderFieldOrder(layout, fromId as GrnHeaderFieldId, toId as GrnHeaderFieldId),
  moveLineColumnOrder: (layout, fromId, toId) =>
    moveGrnLineColumnOrder(layout, fromId as GrnLineSettingsColumnId, toId as GrnLineSettingsColumnId),
  totalsInternalFieldIds: [],
  showTotalsSection: false,
  showImageSection: true,
  showCatalogSection: true,
  catalog: {
    add: addGrnCatalogField,
    createPref: createGrnCatalogFieldPref,
    move: moveGrnCatalogLineFieldOrder,
    remove: removeGrnCatalogField,
  },
};

export const PURCHASE_INVOICE_LAYOUT_ADAPTER: DocumentLayoutModuleAdapter = {
  moduleKey: "PURCHASE_INVOICE",
  label: "Supplier bill",
  defaultLayout: DEFAULT_BILL_SCREEN_LAYOUT,
  normalize: normalizeBillLayoutTemplate,
  patchColumn: patchBillLayoutColumn,
  getLineSettingsColumnOrder: (layout) => getBillLineSettingsColumnOrder(layout),
  isFormHeaderPlaceableField: isBillFormHeaderPlaceableField,
  moveHeaderFieldOrder: (layout, fromId, toId) =>
    moveBillHeaderFieldOrder(layout, fromId as BillHeaderFieldId, toId as BillHeaderFieldId),
  moveLineColumnOrder: (layout, fromId, toId) =>
    moveBillLineColumnOrder(layout, fromId as BillLineSettingsColumnId, toId as BillLineSettingsColumnId),
  moveTotalsFieldOrder: (layout, fromId, toId) =>
    moveBillTotalsFieldOrder(layout, fromId as BillTotalsFieldId, toId as BillTotalsFieldId),
  totalsInternalFieldIds: BILL_TOTALS_INTERNAL_FIELD_IDS,
  showTotalsSection: true,
  showImageSection: true,
  showCatalogSection: true,
  catalog: {
    add: addBillCatalogField,
    createPref: createBillCatalogFieldPref,
    move: moveBillCatalogLineFieldOrder,
    remove: removeBillCatalogField,
  },
};

export const SALES_QUOTATION_LAYOUT_ADAPTER: DocumentLayoutModuleAdapter = {
  moduleKey: "SALES_QUOTATION",
  label: "Quotation",
  defaultLayout: DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT,
  normalize: normalizeSalesQuotationLayoutTemplate,
  patchColumn: patchSalesLayoutColumn,
  getLineSettingsColumnOrder: (layout) => getSalesLineSettingsColumnOrder(layout),
  isFormHeaderPlaceableField: isSalesFormHeaderPlaceableField,
  moveHeaderFieldOrder: (layout, fromId, toId) =>
    moveSalesHeaderFieldOrder(layout, fromId as SalesHeaderFieldId, toId as SalesHeaderFieldId),
  moveLineColumnOrder: (layout, fromId, toId) =>
    moveSalesLineColumnOrder(layout, fromId as SalesLineSettingsColumnId, toId as SalesLineSettingsColumnId),
  moveTotalsFieldOrder: (layout, fromId, toId) =>
    moveSalesTotalsFieldOrder(layout, fromId as SalesTotalsFieldId, toId as SalesTotalsFieldId),
  totalsInternalFieldIds: SALES_TOTALS_INTERNAL_FIELD_IDS,
  showTotalsSection: true,
  showImageSection: false,
  showCatalogSection: true,
  catalog: {
    add: addSalesCatalogField,
    createPref: createSalesCatalogFieldPref,
    move: moveSalesCatalogLineFieldOrder,
    remove: removeSalesCatalogField,
  },
};

export const SALES_ORDER_LAYOUT_ADAPTER: DocumentLayoutModuleAdapter = {
  moduleKey: "SALES_ORDER",
  label: "Sales order",
  defaultLayout: DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  normalize: normalizeSalesOrderLayoutTemplate,
  patchColumn: patchSalesLayoutColumn,
  getLineSettingsColumnOrder: (layout) => getSalesLineSettingsColumnOrder(layout),
  isFormHeaderPlaceableField: isSalesFormHeaderPlaceableField,
  moveHeaderFieldOrder: (layout, fromId, toId) =>
    moveSalesHeaderFieldOrder(layout, fromId as SalesHeaderFieldId, toId as SalesHeaderFieldId),
  moveLineColumnOrder: (layout, fromId, toId) =>
    moveSalesLineColumnOrder(layout, fromId as SalesLineSettingsColumnId, toId as SalesLineSettingsColumnId),
  moveTotalsFieldOrder: (layout, fromId, toId) =>
    moveSalesTotalsFieldOrder(layout, fromId as SalesTotalsFieldId, toId as SalesTotalsFieldId),
  totalsInternalFieldIds: SALES_TOTALS_INTERNAL_FIELD_IDS,
  showTotalsSection: true,
  showImageSection: false,
  showCatalogSection: true,
  catalog: {
    add: addSalesCatalogField,
    createPref: createSalesCatalogFieldPref,
    move: moveSalesCatalogLineFieldOrder,
    remove: removeSalesCatalogField,
  },
};

export const SALES_INVOICE_LAYOUT_ADAPTER: DocumentLayoutModuleAdapter = {
  moduleKey: "SALES_INVOICE",
  label: "Sales invoice",
  defaultLayout: DEFAULT_SALES_INVOICE_SCREEN_LAYOUT,
  normalize: normalizeSalesInvoiceLayoutTemplate,
  patchColumn: patchSalesLayoutColumn,
  getLineSettingsColumnOrder: (layout) => getSalesLineSettingsColumnOrder(layout),
  isFormHeaderPlaceableField: isSalesFormHeaderPlaceableField,
  moveHeaderFieldOrder: (layout, fromId, toId) =>
    moveSalesHeaderFieldOrder(layout, fromId as SalesHeaderFieldId, toId as SalesHeaderFieldId),
  moveLineColumnOrder: (layout, fromId, toId) =>
    moveSalesLineColumnOrder(layout, fromId as SalesLineSettingsColumnId, toId as SalesLineSettingsColumnId),
  moveTotalsFieldOrder: (layout, fromId, toId) =>
    moveSalesTotalsFieldOrder(layout, fromId as SalesTotalsFieldId, toId as SalesTotalsFieldId),
  totalsInternalFieldIds: SALES_TOTALS_INTERNAL_FIELD_IDS,
  showTotalsSection: true,
  showImageSection: false,
  showCatalogSection: true,
  catalog: {
    add: addSalesCatalogField,
    createPref: createSalesCatalogFieldPref,
    move: moveSalesCatalogLineFieldOrder,
    remove: removeSalesCatalogField,
  },
};

export const DOCUMENT_LAYOUT_MODULE_ADAPTERS: Record<
  DocumentModuleKey,
  DocumentLayoutModuleAdapter
> = {
  PURCHASE_ORDER: PURCHASE_ORDER_LAYOUT_ADAPTER,
  GOODS_RECEIPT_NOTE: GOODS_RECEIPT_LAYOUT_ADAPTER,
  PURCHASE_INVOICE: PURCHASE_INVOICE_LAYOUT_ADAPTER,
  SALES_QUOTATION: SALES_QUOTATION_LAYOUT_ADAPTER,
  SALES_ORDER: SALES_ORDER_LAYOUT_ADAPTER,
  SALES_INVOICE: SALES_INVOICE_LAYOUT_ADAPTER,
};
