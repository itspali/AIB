"use server";

import { revalidatePath } from "next/cache";
import { fetchDocumentLayoutTemplate, upsertDocumentLayoutTemplate } from "@/lib/documents/document-layout-queries";
import { layoutScopeKey, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
import { normalizePoLayoutTemplate } from "@/lib/documents/purchase-order-layout";
import type { DocumentLayoutTemplate, DocumentViewContext } from "@/lib/documents/types";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { requireTenantId } from "@/lib/supabase/require-tenant";

export type SavePurchaseOrderDocumentLayoutInput = {
  scope: DocumentLayoutScope;
  viewContext: DocumentViewContext;
  layout: DocumentLayoutTemplate;
};

export async function loadPurchaseOrderDocumentLayout(input: {
  viewContext: DocumentViewContext;
}): Promise<{ layout: DocumentLayoutTemplate } | { error: string }> {
  try {
    const { supabase, tenantId } = await requireTenantId();
    const layout = await fetchDocumentLayoutTemplate(
      supabase,
      tenantId,
      "PURCHASE_ORDER",
      input.viewContext
    );
    return { layout };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to load document layout.",
    };
  }
}

export async function savePurchaseOrderDocumentLayout(
  input: SavePurchaseOrderDocumentLayoutInput
): Promise<{ success: true } | { error: string }> {
  try {
    const { supabase, tenantId, userId } = await requireTenantId();
    const access = await resolveOrganizationSettingsAccess(supabase, userId, tenantId);
    if (!access.granted) {
      return { error: "You do not have permission to edit document layout." };
    }

    if (input.scope.mode === "location") {
      return { error: "Per-location layout overrides are not enabled yet." };
    }

    const layout = normalizePoLayoutTemplate({
      ...input.layout,
      moduleKey: "PURCHASE_ORDER",
      viewContext: input.viewContext,
    });

    if (layout.moduleKey !== "PURCHASE_ORDER") {
      return { error: "Invalid module for purchase order layout." };
    }

    void layoutScopeKey(input.scope);

    await upsertDocumentLayoutTemplate(supabase, tenantId, layout);

    revalidatePath("/settings/modules/procurement");
    revalidatePath("/procurement/purchase-orders");

    return { success: true };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to save document layout.",
    };
  }
}
