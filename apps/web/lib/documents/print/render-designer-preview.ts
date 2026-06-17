import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { DOCUMENT_LAYOUT_MODULE_ADAPTERS } from "@/lib/documents/document-layout-module-adapters";
import { buildDocumentPrintModel } from "@/lib/documents/build-document-print-model";
import { TENANT_LAYOUT_SCOPE } from "@/lib/documents/layout-scope";
import type { DesignerPreviewDraftInput } from "@/lib/documents/print/designer-preview-draft";
import { normalizePresentationShellConfig, normalizePresentationStyleConfig } from "@/lib/documents/print/default-shell-config";
import { getDesignerSampleDocument } from "@/lib/documents/print/designer-sample-documents";
import { fetchDocumentOrgRenderContext } from "@/lib/documents/print/org-render-context";
import { applyGstPresentationOverrides } from "@/lib/documents/print/gst-presentation-compliance";
import { fetchDocumentPresentationTemplate } from "@/lib/documents/print/presentation-queries";
import { renderDocumentHtml } from "@/lib/documents/print/render-document-html";
import type { DocumentPresentationTemplate } from "@/lib/documents/print/types";
import type { DocumentModuleKey } from "@/lib/documents/types";
import { fetchOrganizationGstRegistered } from "@/lib/organization/gst-registration";

export type { DesignerPreviewDraftInput } from "@/lib/documents/print/designer-preview-draft";

function designerPreviewTitle(moduleKey: DocumentModuleKey): string {
  const sample = getDesignerSampleDocument(moduleKey);
  if (moduleKey === "SALES_QUOTATION") return (sample as { quotation_number: string }).quotation_number;
  if (moduleKey === "SALES_INVOICE") return (sample as { invoice_number: string }).invoice_number;
  if (moduleKey === "PURCHASE_INVOICE") {
    return (sample as { system_voucher_number: string }).system_voucher_number;
  }
  return (sample as { voucher_number: string }).voucher_number;
}

export async function renderDocumentDesignerPreviewHtml(
  supabase: SupabaseClient,
  tenantId: string,
  input: DesignerPreviewDraftInput
): Promise<{ html: string } | { error: string }> {
  const scope = input.scope ?? TENANT_LAYOUT_SCOPE;
  const locationId = scope.mode === "location" ? scope.locationId : null;

  try {
    const [existing, org, gstRegistered] = await Promise.all([
      fetchDocumentPresentationTemplate(supabase, tenantId, input.moduleKey, input.viewContext, {
        locationId,
      }),
      fetchDocumentOrgRenderContext(supabase, tenantId, { locationId }),
      fetchOrganizationGstRegistered(supabase, tenantId),
    ]);

    const adapter = DOCUMENT_LAYOUT_MODULE_ADAPTERS[input.moduleKey];
    const normalizedLayout = adapter.normalize({
      ...input.layout,
      moduleKey: input.moduleKey,
      viewContext: input.viewContext,
    });

    const presentation: DocumentPresentationTemplate = applyGstPresentationOverrides(
      {
        ...existing,
        shellConfig: normalizePresentationShellConfig(input.shellConfig),
        styleConfig: normalizePresentationStyleConfig(
          input.styleConfig ?? existing.styleConfig
        ),
      },
      gstRegistered
    );

    const sampleDocument = getDesignerSampleDocument(input.moduleKey);
    const model = buildDocumentPrintModel(input.moduleKey, normalizedLayout, sampleDocument);
    const title = designerPreviewTitle(input.moduleKey);
    const html = renderDocumentHtml(title, model, presentation, org);

    return { html };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Unable to render designer preview." };
  }
}
