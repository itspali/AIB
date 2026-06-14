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
  SALES_INVOICE_LAYOUT_STUB,
  SALES_ORDER_LAYOUT_STUB,
  SALES_QUOTATION_LAYOUT_STUB,
} from "@/lib/documents/sales-layout-stub";
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
  defaultLayout: SALES_QUOTATION_LAYOUT_STUB.normalize({}),
  normalize: SALES_QUOTATION_LAYOUT_STUB.normalize,
  patchColumn: SALES_QUOTATION_LAYOUT_STUB.patchColumn,
  getLineSettingsColumnOrder: SALES_QUOTATION_LAYOUT_STUB.getLineSettingsColumnOrder,
  isFormHeaderPlaceableField: SALES_QUOTATION_LAYOUT_STUB.isFormHeaderPlaceableField,
  moveHeaderFieldOrder: SALES_QUOTATION_LAYOUT_STUB.moveHeaderFieldOrder,
  moveLineColumnOrder: SALES_QUOTATION_LAYOUT_STUB.moveLineColumnOrder,
  totalsInternalFieldIds: [],
  showTotalsSection: true,
  showImageSection: false,
  catalog: SALES_QUOTATION_LAYOUT_STUB.catalog,
};

export const SALES_ORDER_LAYOUT_ADAPTER: DocumentLayoutModuleAdapter = {
  moduleKey: "SALES_ORDER",
  label: "Sales order",
  defaultLayout: SALES_ORDER_LAYOUT_STUB.normalize({}),
  normalize: SALES_ORDER_LAYOUT_STUB.normalize,
  patchColumn: SALES_ORDER_LAYOUT_STUB.patchColumn,
  getLineSettingsColumnOrder: SALES_ORDER_LAYOUT_STUB.getLineSettingsColumnOrder,
  isFormHeaderPlaceableField: SALES_ORDER_LAYOUT_STUB.isFormHeaderPlaceableField,
  moveHeaderFieldOrder: SALES_ORDER_LAYOUT_STUB.moveHeaderFieldOrder,
  moveLineColumnOrder: SALES_ORDER_LAYOUT_STUB.moveLineColumnOrder,
  totalsInternalFieldIds: [],
  showTotalsSection: true,
  showImageSection: false,
  catalog: SALES_ORDER_LAYOUT_STUB.catalog,
};

export const SALES_INVOICE_LAYOUT_ADAPTER: DocumentLayoutModuleAdapter = {
  moduleKey: "SALES_INVOICE",
  label: "Sales invoice",
  defaultLayout: SALES_INVOICE_LAYOUT_STUB.normalize({}),
  normalize: SALES_INVOICE_LAYOUT_STUB.normalize,
  patchColumn: SALES_INVOICE_LAYOUT_STUB.patchColumn,
  getLineSettingsColumnOrder: SALES_INVOICE_LAYOUT_STUB.getLineSettingsColumnOrder,
  isFormHeaderPlaceableField: SALES_INVOICE_LAYOUT_STUB.isFormHeaderPlaceableField,
  moveHeaderFieldOrder: SALES_INVOICE_LAYOUT_STUB.moveHeaderFieldOrder,
  moveLineColumnOrder: SALES_INVOICE_LAYOUT_STUB.moveLineColumnOrder,
  totalsInternalFieldIds: [],
  showTotalsSection: true,
  showImageSection: false,
  catalog: SALES_INVOICE_LAYOUT_STUB.catalog,
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
