import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchDocumentLayoutTemplate,
  fetchDocumentLayoutTemplateIfExists,
} from "@/lib/documents/document-layout-queries";
import { applyGstRegisteredDocumentLayoutOverrides } from "@/lib/documents/gst-document-layout-compliance";
import { normalizeDocumentLayoutTemplate } from "@/lib/documents/normalize-document-layout";
import type { DocumentLayoutScope } from "@/lib/documents/layout-scope";
import type { DocumentLayoutTemplate, DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";
import { fetchOrganizationGstRegistered } from "@/lib/organization/gst-registration";

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
async function resolveStoredDocumentLayout(
  params: ResolveParams
): Promise<DocumentLayoutTemplate> {
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

export async function resolveEffectiveDocumentLayout(
  params: ResolveParams
): Promise<DocumentLayoutTemplate> {
  void params.scope;

  const [layout, gstRegistered] = await Promise.all([
    resolveStoredDocumentLayout(params),
    fetchOrganizationGstRegistered(params.supabase, params.tenantId),
  ]);

  if (!gstRegistered) return layout;

  return normalizeDocumentLayoutTemplate(
    params.moduleKey,
    applyGstRegisteredDocumentLayoutOverrides(layout, true)
  );
}
