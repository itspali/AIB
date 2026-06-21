import "server-only";

import { fetchDocumentLayoutTemplate } from "@/lib/documents/document-layout-queries";
import { fetchDocumentPresentationTemplate } from "@/lib/documents/print/presentation-queries";
import type {
  PresentationShellConfig,
  PresentationStyleConfig,
  PresentationViewContext,
  DocumentPresentationTemplate,
} from "@/lib/documents/print/types";
import type { DocumentLayoutTemplate, DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const DOCUMENT_TEMPLATE_LAYOUT_VIEW_CONTEXTS: DocumentViewContext[] = [
  "SCREEN_GRID",
  "PDF_PRINT",
  "EMAIL_HTML",
];

export const DOCUMENT_TEMPLATE_PRESENTATION_VIEW_CONTEXTS: PresentationViewContext[] = [
  "PDF_PRINT",
  "EMAIL_HTML",
];

export type DocumentTemplatesModuleBundle = {
  moduleKey: DocumentModuleKey;
  layoutsByViewContext: Record<DocumentViewContext, DocumentLayoutTemplate>;
  presentationShells: Record<PresentationViewContext, PresentationShellConfig>;
  presentationStyles: Record<PresentationViewContext, PresentationStyleConfig>;
};

export async function fetchDocumentTemplatesModuleBundle(
  supabase: SupabaseClient,
  tenantId: string,
  moduleKey: DocumentModuleKey
): Promise<DocumentTemplatesModuleBundle> {
  const rows = await Promise.all([
    ...DOCUMENT_TEMPLATE_LAYOUT_VIEW_CONTEXTS.map((viewContext) =>
      fetchDocumentLayoutTemplate(supabase, tenantId, moduleKey, viewContext)
    ),
    ...DOCUMENT_TEMPLATE_PRESENTATION_VIEW_CONTEXTS.map((viewContext) =>
      fetchDocumentPresentationTemplate(supabase, tenantId, moduleKey, viewContext)
    ),
  ]);

  const layoutRowCount = DOCUMENT_TEMPLATE_LAYOUT_VIEW_CONTEXTS.length;
  const layoutRows = rows.slice(0, layoutRowCount) as DocumentLayoutTemplate[];
  const presentationRows = rows.slice(layoutRowCount) as DocumentPresentationTemplate[];

  const layoutsByViewContext = Object.fromEntries(
    DOCUMENT_TEMPLATE_LAYOUT_VIEW_CONTEXTS.map((viewContext, index) => [
      viewContext,
      layoutRows[index]!,
    ])
  ) as Record<DocumentViewContext, DocumentLayoutTemplate>;

  const presentationShells = Object.fromEntries(
    DOCUMENT_TEMPLATE_PRESENTATION_VIEW_CONTEXTS.map((viewContext, index) => [
      viewContext,
      presentationRows[index]!.shellConfig,
    ])
  ) as Record<PresentationViewContext, PresentationShellConfig>;

  const presentationStyles = Object.fromEntries(
    DOCUMENT_TEMPLATE_PRESENTATION_VIEW_CONTEXTS.map((viewContext, index) => [
      viewContext,
      presentationRows[index]!.styleConfig,
    ])
  ) as Record<PresentationViewContext, PresentationStyleConfig>;

  return {
    moduleKey,
    layoutsByViewContext,
    presentationShells,
    presentationStyles,
  };
}
