"use server";

import { layoutScopeKey, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
import { normalizePoLayoutTemplate } from "@/lib/documents/purchase-order-layout";
import type { DocumentLayoutTemplate, DocumentViewContext } from "@/lib/documents/types";
import { requireTenantId } from "@/lib/supabase/require-tenant";

export type SavePurchaseOrderDocumentLayoutInput = {
  scope: DocumentLayoutScope;
  viewContext: DocumentViewContext;
  layout: DocumentLayoutTemplate;
};

/**
 * V1: validates and acknowledges save (no DB persistence until V2).
 * V2: upsert document_layout_templates with nullable location_id from scope.
 */
export async function savePurchaseOrderDocumentLayout(
  input: SavePurchaseOrderDocumentLayoutInput
): Promise<{ success: true } | { error: string }> {
  await requireTenantId();

  const layout = normalizePoLayoutTemplate({
    ...input.layout,
    moduleKey: "PURCHASE_ORDER",
    viewContext: input.viewContext,
  });

  if (layout.moduleKey !== "PURCHASE_ORDER") {
    return { error: "Invalid module for purchase order layout." };
  }

  void layoutScopeKey(input.scope);

  return { success: true };
}
