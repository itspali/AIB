import type { DocumentModuleKey, DocumentLayoutTemplate } from "@/lib/documents/types";
import { normalizeGrnLayoutTemplate } from "@/lib/documents/goods-receipt-layout";
import { normalizeBillLayoutTemplate } from "@/lib/documents/purchase-invoice-layout";
import { normalizePoLayoutTemplate } from "@/lib/documents/purchase-order-layout";
import { shouldShowPoUnitUnderQtyColumn } from "@/lib/procurement/purchase-orders/po-line-unit";
import {
  normalizeSalesCommerceLayoutTemplate,
  normalizeSalesInvoiceLayoutTemplate,
  normalizeSalesOrderLayoutTemplate,
  normalizeSalesQuotationLayoutTemplate,
} from "@/lib/sales/shared/sales-commerce-layout";
import { shouldShowSalesUnitUnderQtyColumn } from "@/lib/sales/shared/sales-line-display";

export type DocumentPrintLayoutHints = {
  showUnitUnderQty: boolean;
  quantityColumnIds: readonly string[];
  unitFieldId: string;
};

function salesLayoutForModule(
  moduleKey: "SALES_QUOTATION" | "SALES_ORDER" | "SALES_INVOICE",
  layout: DocumentLayoutTemplate
) {
  switch (moduleKey) {
    case "SALES_QUOTATION":
      return normalizeSalesQuotationLayoutTemplate(layout);
    case "SALES_INVOICE":
      return normalizeSalesInvoiceLayoutTemplate(layout);
    default:
      return normalizeSalesOrderLayoutTemplate(layout);
  }
}

export function resolvePrintLayoutHints(
  moduleKey: DocumentModuleKey,
  layout: DocumentLayoutTemplate
): DocumentPrintLayoutHints {
  switch (moduleKey) {
    case "SALES_QUOTATION":
      return {
        showUnitUnderQty: shouldShowSalesUnitUnderQtyColumn(
          salesLayoutForModule("SALES_QUOTATION", layout)
        ),
        quantityColumnIds: ["quantity_quoted"],
        unitFieldId: "unit",
      };
    case "SALES_ORDER":
      return {
        showUnitUnderQty: shouldShowSalesUnitUnderQtyColumn(
          salesLayoutForModule("SALES_ORDER", layout)
        ),
        quantityColumnIds: ["quantity_ordered"],
        unitFieldId: "unit",
      };
    case "SALES_INVOICE":
      return {
        showUnitUnderQty: shouldShowSalesUnitUnderQtyColumn(
          salesLayoutForModule("SALES_INVOICE", layout)
        ),
        quantityColumnIds: ["quantity_invoiced", "quantity_ordered"],
        unitFieldId: "unit",
      };
    case "PURCHASE_ORDER":
      return {
        showUnitUnderQty: shouldShowPoUnitUnderQtyColumn(normalizePoLayoutTemplate(layout)),
        quantityColumnIds: ["quantity_ordered"],
        unitFieldId: "unit",
      };
    case "GOODS_RECEIPT_NOTE":
      return {
        showUnitUnderQty: shouldShowPoUnitUnderQtyColumn(normalizeGrnLayoutTemplate(layout)),
        quantityColumnIds: ["quantity_received", "quantity_ordered"],
        unitFieldId: "unit",
      };
    case "PURCHASE_INVOICE":
      return {
        showUnitUnderQty: shouldShowPoUnitUnderQtyColumn(normalizeBillLayoutTemplate(layout)),
        quantityColumnIds: ["quantity_invoiced", "quantity_ordered"],
        unitFieldId: "unit",
      };
    default:
      return {
        showUnitUnderQty: false,
        quantityColumnIds: [],
        unitFieldId: "unit",
      };
  }
}
