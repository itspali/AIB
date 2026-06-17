import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildPrintModelForDocument,
  getDocumentPrintAdapter,
} from "@/lib/documents/print/document-print-registry";
import {
  computeDocumentRenderFingerprint,
  readDocumentSourceUpdatedAt,
} from "@/lib/documents/print/document-pdf-cache";
import { fetchDocumentOrgRenderContext } from "@/lib/documents/print/org-render-context";
import { resolveEffectivePresentationTemplate } from "@/lib/documents/print/resolve-effective-presentation";
import { renderDocumentHtml } from "@/lib/documents/print/render-document-html";
import type { PresentationViewContext } from "@/lib/documents/print/types";
import { resolveEffectiveDocumentLayout } from "@/lib/documents/resolve-effective-document-layout";
import type { DocumentModuleKey } from "@/lib/documents/types";

export type DocumentRenderPayload = {
  title: string;
  html: string;
  locationId: string | null;
  sourceUpdatedAt: string;
  renderFingerprint: string;
};

export async function resolveDocumentRenderPayload(input: {
  supabase: SupabaseClient;
  tenantId: string;
  moduleKey: DocumentModuleKey;
  documentId: string;
  documentLocationId?: string | null;
  viewContext?: PresentationViewContext;
}): Promise<{ payload: DocumentRenderPayload } | { error: string }> {
  const adapter = getDocumentPrintAdapter(input.moduleKey);
  if (!adapter) {
    return { error: "Print is not supported for this document type." };
  }

  const viewContext = input.viewContext ?? "PDF_PRINT";
  const document = await adapter.fetchDocument(input.supabase, input.tenantId, input.documentId);
  if (!document) {
    return { error: "Document not found." };
  }

  const locationId =
    input.documentLocationId?.trim() || adapter.getLocationId(document) || null;

  const [layout, presentation, org] = await Promise.all([
    resolveEffectiveDocumentLayout({
      supabase: input.supabase,
      tenantId: input.tenantId,
      moduleKey: input.moduleKey,
      viewContext,
      documentLocationId: locationId,
    }),
    resolveEffectivePresentationTemplate({
      supabase: input.supabase,
      tenantId: input.tenantId,
      moduleKey: input.moduleKey,
      viewContext,
      documentLocationId: locationId,
    }),
    fetchDocumentOrgRenderContext(input.supabase, input.tenantId, { locationId }),
  ]);

  const title = adapter.getTitle(document);
  const model = buildPrintModelForDocument(input.moduleKey, layout, document);
  const renderFingerprint = computeDocumentRenderFingerprint(presentation, layout);

  return {
    payload: {
      title,
      html: renderDocumentHtml(title, model, presentation, org),
      locationId,
      sourceUpdatedAt: readDocumentSourceUpdatedAt(
        document as unknown as Record<string, unknown>
      ),
      renderFingerprint,
    },
  };
}
