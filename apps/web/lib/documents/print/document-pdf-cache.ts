import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DocumentLayoutTemplate } from "@/lib/documents/types";
import type {
  DocumentPresentationTemplate,
  PresentationViewContext,
} from "@/lib/documents/print/types";
import type { DocumentModuleKey } from "@/lib/documents/types";

export const DOCUMENT_PDF_BUCKET = "document-pdfs";

export function documentPdfLocationScope(locationId: string | null): string {
  return locationId?.trim() || "tenant";
}

export type DocumentPdfCacheLookup = {
  tenantId: string;
  moduleKey: DocumentModuleKey;
  documentId: string;
  viewContext: PresentationViewContext;
  locationId: string | null;
  sourceUpdatedAt: string;
  renderFingerprint: string;
};

export function buildDocumentPdfStoragePath(input: {
  tenantId: string;
  moduleKey: DocumentModuleKey;
  documentId: string;
  viewContext: PresentationViewContext;
  locationId: string | null;
}): string {
  const locationSegment = input.locationId?.trim() || "tenant";
  return `${input.tenantId}/${input.moduleKey}/${input.documentId}/${input.viewContext}/${locationSegment}.pdf`;
}

export function computeDocumentRenderFingerprint(
  presentation: DocumentPresentationTemplate,
  layout: DocumentLayoutTemplate
): string {
  const payload = JSON.stringify({
    shellConfig: presentation.shellConfig,
    styleConfig: presentation.styleConfig,
    layout,
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function readDocumentSourceUpdatedAt(document: Record<string, unknown>): string {
  for (const key of ["updated_at", "received_at", "posting_at", "created_at"]) {
    const value = document[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return new Date(0).toISOString();
}

export async function getCachedDocumentPdf(
  supabase: SupabaseClient,
  lookup: DocumentPdfCacheLookup
): Promise<Buffer | null> {
  const { data: row, error } = await supabase
    .from("document_pdf_cache")
    .select("storage_path, source_updated_at, render_fingerprint")
    .eq("tenant_id", lookup.tenantId)
    .eq("module_key", lookup.moduleKey)
    .eq("document_id", lookup.documentId)
    .eq("view_context", lookup.viewContext)
    .eq("location_scope", documentPdfLocationScope(lookup.locationId))
    .maybeSingle();

  if (error || !row) return null;

  if (
    row.source_updated_at !== lookup.sourceUpdatedAt ||
    row.render_fingerprint !== lookup.renderFingerprint
  ) {
    return null;
  }

  const { data: file, error: downloadError } = await supabase.storage
    .from(DOCUMENT_PDF_BUCKET)
    .download(row.storage_path);

  if (downloadError || !file) return null;

  const bytes = Buffer.from(await file.arrayBuffer());
  return bytes.length > 0 ? bytes : null;
}

export async function putCachedDocumentPdf(
  supabase: SupabaseClient,
  lookup: DocumentPdfCacheLookup,
  pdfBuffer: Buffer
): Promise<void> {
  const storagePath = buildDocumentPdfStoragePath({
    tenantId: lookup.tenantId,
    moduleKey: lookup.moduleKey,
    documentId: lookup.documentId,
    viewContext: lookup.viewContext,
    locationId: lookup.locationId,
  });

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_PDF_BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: upsertError } = await supabase.from("document_pdf_cache").upsert(
    {
      tenant_id: lookup.tenantId,
      module_key: lookup.moduleKey,
      document_id: lookup.documentId,
      view_context: lookup.viewContext,
      location_id: lookup.locationId,
      location_scope: documentPdfLocationScope(lookup.locationId),
      storage_path: storagePath,
      source_updated_at: lookup.sourceUpdatedAt,
      render_fingerprint: lookup.renderFingerprint,
    },
    {
      onConflict: "tenant_id,module_key,document_id,view_context,location_scope",
    }
  );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}

export async function invalidateDocumentPdfCacheForModule(
  supabase: SupabaseClient,
  tenantId: string,
  moduleKey: DocumentModuleKey
): Promise<void> {
  const { data: rows, error } = await supabase
    .from("document_pdf_cache")
    .select("storage_path")
    .eq("tenant_id", tenantId)
    .eq("module_key", moduleKey);

  if (error) return;

  const paths = (rows ?? []).map((row) => row.storage_path as string).filter(Boolean);
  if (paths.length > 0) {
    await supabase.storage.from(DOCUMENT_PDF_BUCKET).remove(paths);
  }

  await supabase
    .from("document_pdf_cache")
    .delete()
    .eq("tenant_id", tenantId)
    .eq("module_key", moduleKey);
}
