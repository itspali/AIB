import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchDocumentPresentationTemplate,
  fetchDocumentPresentationTemplateIfExists,
} from "@/lib/documents/print/presentation-queries";
import type { DocumentPresentationTemplate, PresentationViewContext } from "@/lib/documents/print/types";
import type { DocumentModuleKey } from "@/lib/documents/types";

type ResolveParams = {
  supabase: SupabaseClient;
  tenantId: string;
  moduleKey: DocumentModuleKey;
  viewContext: PresentationViewContext;
  documentLocationId?: string | null;
};

async function resolveStoredPresentationTemplate(
  params: ResolveParams
): Promise<DocumentPresentationTemplate> {
  const documentLocationId = params.documentLocationId?.trim() || null;

  if (documentLocationId) {
    const locationTemplate = await fetchDocumentPresentationTemplateIfExists(
      params.supabase,
      params.tenantId,
      params.moduleKey,
      params.viewContext,
      { locationId: documentLocationId }
    );
    if (locationTemplate) return locationTemplate;
  }

  return fetchDocumentPresentationTemplate(
    params.supabase,
    params.tenantId,
    params.moduleKey,
    params.viewContext,
    { locationId: null }
  );
}

export async function resolveEffectivePresentationTemplate(
  params: ResolveParams
): Promise<DocumentPresentationTemplate> {
  return resolveStoredPresentationTemplate(params);
}
