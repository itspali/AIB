import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  normalizePoLayoutTemplate,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentLayoutScope } from "@/lib/documents/layout-scope";
import type { DocumentLayoutTemplate, DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";

type ResolveParams = {
  supabase: SupabaseClient;
  tenantId: string;
  moduleKey: DocumentModuleKey;
  viewContext: DocumentViewContext;
  /** PO destination / primary document location — used for location override in a later phase. */
  documentLocationId?: string | null;
  scope?: DocumentLayoutScope;
};

/**
 * Resolve the effective document layout for runtime surfaces (drawer, peek, print).
 * V1: returns code defaults. V2: load tenant row, then optional location override.
 */
export async function resolveEffectiveDocumentLayout(
  params: ResolveParams
): Promise<DocumentLayoutTemplate> {
  void params;

  if (params.moduleKey === "PURCHASE_ORDER") {
    return normalizePoLayoutTemplate({
      ...DEFAULT_PO_SCREEN_LAYOUT,
      viewContext: params.viewContext,
    });
  }

  return normalizePoLayoutTemplate(DEFAULT_PO_SCREEN_LAYOUT);
}
