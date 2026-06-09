import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchDocumentLayoutTemplate } from "@/lib/documents/document-layout-queries";
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
 * Tenant row when saved; code defaults when no row exists. Location overrides later.
 */
export async function resolveEffectiveDocumentLayout(
  params: ResolveParams
): Promise<DocumentLayoutTemplate> {
  void params.documentLocationId;
  void params.scope;

  return fetchDocumentLayoutTemplate(
    params.supabase,
    params.tenantId,
    params.moduleKey,
    params.viewContext
  );
}
