import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDocumentPrintModel } from "@/lib/documents/build-document-print-model";
import type { DocumentModuleKey } from "@/lib/documents/types";
import { fetchGoodsReceiptById } from "@/lib/procurement/goods-receipts/queries";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import { fetchPurchaseBillById } from "@/lib/procurement/bills/queries";
import type { PurchaseBillRow } from "@/lib/procurement/bills/types";
import { fetchPurchaseOrderById } from "@/lib/procurement/purchase-orders/queries";
import type { PurchaseOrderRow } from "@/lib/procurement/purchase-orders/types";
import { fetchSalesQuotationById } from "@/lib/sales/quotes/queries";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";

export type PrintableDocumentRow =
  | PurchaseOrderRow
  | GoodsReceiptRow
  | PurchaseBillRow
  | SalesQuoteRow;

export type DocumentPrintAdapter = {
  moduleKey: DocumentModuleKey;
  fetchDocument: (
    supabase: SupabaseClient,
    tenantId: string,
    documentId: string
  ) => Promise<PrintableDocumentRow | null>;
  getTitle: (document: PrintableDocumentRow) => string;
  getLocationId: (document: PrintableDocumentRow) => string | null;
};

export const PURCHASE_ORDER_PRINT_ADAPTER: DocumentPrintAdapter = {
  moduleKey: "PURCHASE_ORDER",
  fetchDocument: fetchPurchaseOrderById,
  getTitle: (document) => (document as PurchaseOrderRow).voucher_number,
  getLocationId: (document) => (document as PurchaseOrderRow).destination_location_id ?? null,
};

export const GOODS_RECEIPT_PRINT_ADAPTER: DocumentPrintAdapter = {
  moduleKey: "GOODS_RECEIPT_NOTE",
  fetchDocument: fetchGoodsReceiptById,
  getTitle: (document) => (document as GoodsReceiptRow).voucher_number,
  getLocationId: (document) => (document as GoodsReceiptRow).destination_location_id ?? null,
};

export const PURCHASE_INVOICE_PRINT_ADAPTER: DocumentPrintAdapter = {
  moduleKey: "PURCHASE_INVOICE",
  fetchDocument: fetchPurchaseBillById,
  getTitle: (document) => (document as PurchaseBillRow).system_voucher_number,
  getLocationId: () => null,
};

export const SALES_QUOTATION_PRINT_ADAPTER: DocumentPrintAdapter = {
  moduleKey: "SALES_QUOTATION",
  fetchDocument: fetchSalesQuotationById,
  getTitle: (document) => (document as SalesQuoteRow).quotation_number,
  getLocationId: (document) => (document as SalesQuoteRow).origin_location_id ?? null,
};

export const DOCUMENT_PRINT_REGISTRY: Partial<Record<DocumentModuleKey, DocumentPrintAdapter>> = {
  PURCHASE_ORDER: PURCHASE_ORDER_PRINT_ADAPTER,
  GOODS_RECEIPT_NOTE: GOODS_RECEIPT_PRINT_ADAPTER,
  PURCHASE_INVOICE: PURCHASE_INVOICE_PRINT_ADAPTER,
  SALES_QUOTATION: SALES_QUOTATION_PRINT_ADAPTER,
};

export function getDocumentPrintAdapter(
  moduleKey: DocumentModuleKey
): DocumentPrintAdapter | null {
  return DOCUMENT_PRINT_REGISTRY[moduleKey] ?? null;
}

export function buildPrintModelForDocument(
  moduleKey: DocumentModuleKey,
  layout: Parameters<typeof buildDocumentPrintModel>[1],
  document: PrintableDocumentRow
) {
  return buildDocumentPrintModel(
    moduleKey,
    layout,
    document as PurchaseOrderRow | GoodsReceiptRow | PurchaseBillRow | SalesQuoteRow
  );
}
