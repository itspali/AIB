"use server";

import { fetchGoodsReceiptById } from "@/lib/procurement/goods-receipts/queries";
import { fetchPurchaseBillById } from "@/lib/procurement/bills/queries";
import { fetchPurchaseOrderById } from "@/lib/procurement/purchase-orders/queries";
import { resolveEffectiveDocumentLayout } from "@/lib/documents/resolve-effective-document-layout";
import { buildDocumentPrintModel } from "@/lib/documents/build-document-print-model";
import type { DocumentModuleKey } from "@/lib/documents/types";
import { requireTenantId } from "@/lib/supabase/require-tenant";

export type DocumentPrintPayload = {
  title: string;
  model: ReturnType<typeof buildDocumentPrintModel>;
};

export async function loadDocumentPrintPayload(input: {
  moduleKey: DocumentModuleKey;
  documentId: string;
  documentLocationId?: string | null;
}): Promise<{ payload: DocumentPrintPayload } | { error: string }> {
  try {
    const { supabase, tenantId } = await requireTenantId();
    const layout = await resolveEffectiveDocumentLayout({
      supabase,
      tenantId,
      moduleKey: input.moduleKey,
      viewContext: "PDF_PRINT",
      documentLocationId: input.documentLocationId,
    });

    if (input.moduleKey === "PURCHASE_ORDER") {
      const order = await fetchPurchaseOrderById(supabase, tenantId, input.documentId);
      if (!order) return { error: "Purchase order not found." };
      return {
        payload: {
          title: order.voucher_number,
          model: buildDocumentPrintModel("PURCHASE_ORDER", layout, order),
        },
      };
    }

    if (input.moduleKey === "GOODS_RECEIPT_NOTE") {
      const receipt = await fetchGoodsReceiptById(supabase, tenantId, input.documentId);
      if (!receipt) return { error: "Goods receipt not found." };
      return {
        payload: {
          title: receipt.voucher_number,
          model: buildDocumentPrintModel("GOODS_RECEIPT_NOTE", layout, receipt),
        },
      };
    }

    if (input.moduleKey === "PURCHASE_INVOICE") {
      const bill = await fetchPurchaseBillById(supabase, tenantId, input.documentId);
      if (!bill) return { error: "Bill not found." };
      return {
        payload: {
          title: bill.system_voucher_number,
          model: buildDocumentPrintModel("PURCHASE_INVOICE", layout, bill),
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
