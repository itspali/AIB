import { normalizeBillLayoutTemplate } from "@/lib/documents/purchase-invoice-layout";
import { normalizeGrnLayoutTemplate } from "@/lib/documents/goods-receipt-layout";
import { normalizePoLayoutTemplate } from "@/lib/documents/purchase-order-layout";
import type { DocumentLayoutDefaults, DocumentLayoutTemplate, DocumentModuleKey } from "@/lib/documents/types";

export function normalizeDocumentLayoutTemplate(
  moduleKey: DocumentModuleKey,
  template: Partial<DocumentLayoutTemplate> | DocumentLayoutDefaults
): DocumentLayoutTemplate {
  switch (moduleKey) {
    case "GOODS_RECEIPT_NOTE":
      return normalizeGrnLayoutTemplate({ ...template, moduleKey });
    case "PURCHASE_INVOICE":
      return normalizeBillLayoutTemplate({ ...template, moduleKey });
    case "PURCHASE_ORDER":
    default:
      return normalizePoLayoutTemplate({ ...template, moduleKey: moduleKey === "PURCHASE_ORDER" ? moduleKey : "PURCHASE_ORDER" });
  }
}

export function defaultDocumentLayoutTemplate(
  moduleKey: DocumentModuleKey,
  viewContext: DocumentLayoutTemplate["viewContext"] = "SCREEN_GRID"
): DocumentLayoutTemplate {
  return normalizeDocumentLayoutTemplate(moduleKey, { moduleKey, viewContext });
}
