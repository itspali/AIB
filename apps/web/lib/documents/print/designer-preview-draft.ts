import { DOCUMENT_LAYOUT_MODULE_ADAPTERS } from "@/lib/documents/document-layout-module-adapters";
import { applyGstRegisteredDocumentLayoutOverrides } from "@/lib/documents/gst-document-layout-compliance";
import { layoutScopeKey, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
import type { PresentationShellConfig, PresentationStyleConfig, PresentationViewContext } from "@/lib/documents/print/types";
import type { DocumentLayoutTemplate, DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";

/** Match document-layout-panel hydration so SSR preview seeds hit client cache. */
export function normalizeDesignerPreviewLayout(
  moduleKey: DocumentModuleKey,
  viewContext: DocumentViewContext,
  layout: DocumentLayoutTemplate,
  gstRegistered: boolean
): DocumentLayoutTemplate {
  const adapter = DOCUMENT_LAYOUT_MODULE_ADAPTERS[moduleKey];
  const normalized = adapter.normalize({ ...layout, viewContext, moduleKey });
  return gstRegistered
    ? applyGstRegisteredDocumentLayoutOverrides(normalized, true, adapter.catalog.createPref)
    : normalized;
}

export type DesignerPreviewDraftInput = {
  moduleKey: DocumentModuleKey;
  viewContext: PresentationViewContext;
  scope: DocumentLayoutScope;
  layout: DocumentLayoutTemplate;
  shellConfig: PresentationShellConfig;
  styleConfig?: PresentationStyleConfig;
};

export function buildDesignerPreviewDraftKey(input: DesignerPreviewDraftInput): string {
  return JSON.stringify({
    moduleKey: input.moduleKey,
    viewContext: input.viewContext,
    scope: layoutScopeKey(input.scope),
    layout: {
      ...input.layout,
      moduleKey: input.moduleKey,
      viewContext: input.viewContext,
    },
    shellConfig: input.shellConfig,
    styleConfig: input.styleConfig ?? null,
  });
}
