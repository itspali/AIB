"use server";

import { resolveDocumentRenderPayload } from "@/lib/documents/print/resolve-document-render";
import { generatePdfFromHtml } from "@/lib/email/generate-document-pdf";
import type { PresentationViewContext } from "@/lib/documents/print/types";
import type { DocumentModuleKey } from "@/lib/documents/types";
import { requireTenantId } from "@/lib/supabase/require-tenant";

export type DocumentPrintPayload = {
  title: string;
  html: string;
};

export async function loadDocumentPrintPayload(input: {
  moduleKey: DocumentModuleKey;
  documentId: string;
  documentLocationId?: string | null;
  viewContext?: PresentationViewContext;
}): Promise<{ payload: DocumentPrintPayload } | { error: string }> {
  try {
    const { supabase, tenantId } = await requireTenantId();
    const result = await resolveDocumentRenderPayload({
      supabase,
      tenantId,
      ...input,
    });
    if ("error" in result) return result;
    return { payload: { title: result.payload.title, html: result.payload.html } };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to prepare print layout.",
    };
  }
}

export async function downloadDocumentPdf(input: {
  moduleKey: DocumentModuleKey;
  documentId: string;
  documentLocationId?: string | null;
}): Promise<{ filename: string; pdfBase64: string } | { error: string }> {
  try {
    const { supabase, tenantId } = await requireTenantId();
    const result = await resolveDocumentRenderPayload({
      supabase,
      tenantId,
      moduleKey: input.moduleKey,
      documentId: input.documentId,
      documentLocationId: input.documentLocationId,
      viewContext: "PDF_PRINT",
    });

    if ("error" in result) return result;

    const pdfBuffer = await generatePdfFromHtml(result.payload.html);
    if (!pdfBuffer) {
      return {
        error:
          "PDF generation is unavailable. Configure Puppeteer locally or use Print instead.",
      };
    }

    const safeTitle = result.payload.title.replace(/[^\w.-]+/g, "_");
    return {
      filename: `${safeTitle}.pdf`,
      pdfBase64: pdfBuffer.toString("base64"),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Unable to generate PDF.",
    };
  }
}
