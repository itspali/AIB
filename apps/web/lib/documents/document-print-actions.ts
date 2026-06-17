"use server";

import { fetchGoodsReceiptById } from "@/lib/procurement/goods-receipts/queries";
import { fetchPurchaseBillById } from "@/lib/procurement/bills/queries";
import { fetchPurchaseOrderById } from "@/lib/procurement/purchase-orders/queries";
import { buildDocumentPrintModel } from "@/lib/documents/build-document-print-model";
import { resolveEffectiveDocumentLayout } from "@/lib/documents/resolve-effective-document-layout";
import { fetchDocumentOrgRenderContext } from "@/lib/documents/print/org-render-context";
import { resolveEffectivePresentationTemplate } from "@/lib/documents/print/resolve-effective-presentation";
import { renderDocumentHtml } from "@/lib/documents/print/render-document-html";
import type { PresentationViewContext } from "@/lib/documents/print/types";
import type { DocumentModuleKey } from "@/lib/documents/types";
import { requireTenantId } from "@/lib/supabase/require-tenant";

export type DocumentPrintPayload = {
  title: string;
  html: string;
};

export async function loadDocumentPrintPayload(input: {
  moduleKey: DocumentModuleKey;
  documentId: string;
  documentLocationId?: string | null;
  viewContext?: PresentationViewContext;
}): Promise<{ payload: DocumentPrintPayload } | { error: string }> {
  try {
    const { supabase, tenantId } = await requireTenantId();
    const viewContext = input.viewContext ?? "PDF_PRINT";

    const [layout, presentation, org] = await Promise.all([
      resolveEffectiveDocumentLayout({
        supabase,
        tenantId,
        moduleKey: input.moduleKey,
        viewContext,
        documentLocationId: input.documentLocationId,
      }),
      resolveEffectivePresentationTemplate({
        supabase,
        tenantId,
        moduleKey: input.moduleKey,
        viewContext,
        documentLocationId: input.documentLocationId,
      }),
      fetchDocumentOrgRenderContext(supabase, tenantId),
    ]);

    if (input.moduleKey === "PURCHASE_ORDER") {
      const order = await fetchPurchaseOrderById(supabase, tenantId, input.documentId);
      if (!order) return { error: "Purchase order not found." };
      const model = buildDocumentPrintModel("PURCHASE_ORDER", layout, order);
      return {
        payload: {
          title: order.voucher_number,
          html: renderDocumentHtml(order.voucher_number, model, presentation, org),
        },
      };
    }

    if (input.moduleKey === "GOODS_RECEIPT_NOTE") {
      const receipt = await fetchGoodsReceiptById(supabase, tenantId, input.documentId);
      if (!receipt) return { error: "Goods receipt not found." };
      const model = buildDocumentPrintModel("GOODS_RECEIPT_NOTE", layout, receipt);
      return {
        payload: {
          title: receipt.voucher_number,
          html: renderDocumentHtml(receipt.voucher_number, model, presentation, org),
        },
      };
    }

    if (input.moduleKey === "PURCHASE_INVOICE") {
      const bill = await fetchPurchaseBillById(supabase, tenantId, input.documentId);
      if (!bill) return { error: "Bill not found." };
      const model = buildDocumentPrintModel("PURCHASE_INVOICE", layout, bill);
      return {
        payload: {
          title: bill.system_voucher_number,
          html: renderDocumentHtml(bill.system_voucher_number, model, presentation, org),
        },
      };
    }

    if (input.moduleKey === "SALES_QUOTATION") {
      const { fetchSalesQuotationById } = await import("@/lib/sales/quotes/queries");
      const quote = await fetchSalesQuotationById(supabase, tenantId, input.documentId);
      if (!quote) return { error: "Quote not found." };
      const model = buildDocumentPrintModel("SALES_QUOTATION", layout, quote);
      return {
        payload: {
          title: quote.quotation_number,
          html: renderDocumentHtml(quote.quotation_number, model, presentation, org),
        },
      };
    }

    return { error: "Print is not supported for this document type." };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to prepare print layout.",
    };
  }
}
