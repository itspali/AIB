import type { SupabaseClient } from "@supabase/supabase-js";
import { applyGstPresentationOverrides } from "@/lib/documents/print/gst-presentation-compliance";
import {
  fetchDocumentPresentationTemplate,
  fetchDocumentPresentationTemplateIfExists,
} from "@/lib/documents/print/presentation-queries";
import type { DocumentPresentationTemplate, PresentationViewContext } from "@/lib/documents/print/types";
import type { DocumentModuleKey } from "@/lib/documents/types";
import { fetchOrganizationGstRegistered } from "@/lib/organization/gst-registration";

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
  const [template, gstRegistered] = await Promise.all([
    resolveStoredPresentationTemplate(params),
    fetchOrganizationGstRegistered(params.supabase, params.tenantId),
  ]);

  return applyGstPresentationOverrides(template, gstRegistered);
}
