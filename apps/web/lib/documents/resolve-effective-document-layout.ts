import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchDocumentLayoutTemplate,
  fetchDocumentLayoutTemplateIfExists,
} from "@/lib/documents/document-layout-queries";
import type { DocumentLayoutScope } from "@/lib/documents/layout-scope";
import type { DocumentLayoutTemplate, DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";

type ResolveParams = {
  supabase: SupabaseClient;
  tenantId: string;
  moduleKey: DocumentModuleKey;
  viewContext: DocumentViewContext;
  /** PO destination / primary document location — location override when set. */
  documentLocationId?: string | null;
  scope?: DocumentLayoutScope;
};

/**
 * Resolve the effective document layout for runtime surfaces (drawer, peek, print).
 * Location override → tenant default → code defaults (inside fetchDocumentLayoutTemplate).
 */
export async function resolveEffectiveDocumentLayout(
  params: ResolveParams
): Promise<DocumentLayoutTemplate> {
  void params.scope;

  const documentLocationId = params.documentLocationId?.trim() || null;

  if (documentLocationId) {
    const locationLayout = await fetchDocumentLayoutTemplateIfExists(
      params.supabase,
      params.tenantId,
      params.moduleKey,
      params.viewContext,
      { locationId: documentLocationId }
    );
    if (locationLayout) return locationLayout;
  }

  return fetchDocumentLayoutTemplate(
    params.supabase,
    params.tenantId,
    params.moduleKey,
    params.viewContext,
    { locationId: null }
  );
}
