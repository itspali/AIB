import {
  saveGoodsReceiptDocumentLayout,
  savePurchaseInvoiceDocumentLayout,
  savePurchaseOrderDocumentLayout,
} from "@/app/settings/operations/procurement/actions";
import {
  saveSalesInvoiceDocumentLayout,
  saveSalesOrderDocumentLayout,
  saveSalesQuotationDocumentLayout,
} from "@/app/settings/operations/sales/actions";
import type { SaveDocumentLayoutInput } from "@/app/settings/operations/procurement/actions";
import type { DocumentModuleKey } from "@/lib/documents/types";

export type DocumentLayoutSaveFn = (
  input: SaveDocumentLayoutInput
) => Promise<{ success: true } | { error: string }>;

export function getDocumentLayoutSaveFn(moduleKey: DocumentModuleKey): DocumentLayoutSaveFn | null {
  switch (moduleKey) {
    case "PURCHASE_ORDER":
      return savePurchaseOrderDocumentLayout;
    case "GOODS_RECEIPT_NOTE":
      return saveGoodsReceiptDocumentLayout;
    case "PURCHASE_INVOICE":
      return savePurchaseInvoiceDocumentLayout;
    case "SALES_QUOTATION":
      return saveSalesQuotationDocumentLayout;
    case "SALES_ORDER":
      return saveSalesOrderDocumentLayout;
    case "SALES_INVOICE":
      return saveSalesInvoiceDocumentLayout;
    default:
      return null;
  }
}
