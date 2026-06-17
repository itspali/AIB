"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { loadDocumentDesignerPreview } from "@/app/settings/documents/templates/actions";
import { DocumentDesignerPreviewToolbar } from "@/components/settings/document-templates/document-designer-preview-toolbar";
import { layoutScopeKey, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
import { DOCUMENT_DESIGNER_LAYOUT_PRESETS } from "@/lib/documents/print/document-designer-layout-presets";
import { presentationPagePreviewDimensions } from "@/lib/documents/print/presentation-page-dimensions";
import type {
  PresentationPageSize,
  PresentationShellConfig,
  PresentationViewContext,
} from "@/lib/documents/print/types";
import type { DocumentLayoutTemplate, DocumentModuleKey } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

const PREVIEW_DEBOUNCE_MS = 800;
const GENERATED_PRESET_ID = "generated";

type Props = {
  moduleKey: DocumentModuleKey;
  viewContext: PresentationViewContext;
  scope: DocumentLayoutScope;
  layout: DocumentLayoutTemplate;
  shellConfig: PresentationShellConfig;
  shellLoadError?: string | null;
  canEdit: boolean;
  activePresetId: string;
  isGeneratedLayout: boolean;
  onSelectPreset: (presetId: string) => void;
  onPreviousPreset: () => void;
  onNextPreset: () => void;
  onPageSizeChange: (size: PresentationPageSize) => void;
  onAutoGenerate: () => void;
};

function previewDraftKey(
  moduleKey: DocumentModuleKey,
  viewContext: PresentationViewContext,
  scope: DocumentLayoutScope,
  layout: DocumentLayoutTemplate,
  shellConfig: PresentationShellConfig
): string {
  return JSON.stringify({
    moduleKey,
    viewContext,
    scope: layoutScopeKey(scope),
    layout,
    shellConfig,
  });
}

export function DocumentDesignerLivePreview({
  moduleKey,
  viewContext,
  scope,
  layout,
  shellConfig,
  shellLoadError,
  canEdit,
  activePresetId,
  isGeneratedLayout,
  onSelectPreset,
  onPreviousPreset,
  onNextPreset,
  onPageSizeChange,
  onAutoGenerate,
}: Props) {
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const requestIdRef = useRef(0);

  const scopeKey = layoutScopeKey(scope);
  const structuralKey = `${moduleKey}:${viewContext}:${scopeKey}`;
  const prevStructuralKeyRef = useRef(structuralKey);

  const draftKey = useMemo(() => {
    return previewDraftKey(moduleKey, viewContext, scope, layout, shellConfig);
  }, [moduleKey, viewContext, scope, layout, shellConfig]);

  const [activeDraftKey, setActiveDraftKey] = useState<string | null>(draftKey);

  useEffect(() => {
    if (!draftKey) {
      setActiveDraftKey(null);
      return;
    }

    if (prevStructuralKeyRef.current !== structuralKey) {
      prevStructuralKeyRef.current = structuralKey;
      setActiveDraftKey(draftKey);
      return;
    }

    const timer = window.setTimeout(() => setActiveDraftKey(draftKey), PREVIEW_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [structuralKey, draftKey]);

  useEffect(() => {
    if (!activeDraftKey) return;

    const requestId = ++requestIdRef.current;
    startTransition(async () => {
      const result = await loadDocumentDesignerPreview({
        moduleKey,
        viewContext,
        scope,
        shellConfig,
        layout: {
          ...layout,
          moduleKey,
          viewContext,
        },
      });

      if (requestId !== requestIdRef.current) return;
      if ("html" in result) {
        setPreviewError(null);
        setPreviewHtml(result.html);
        return;
      }
      setPreviewError(result.error);
    });
  }, [activeDraftKey, refreshNonce, moduleKey, viewContext, scope, layout, shellConfig]);

  const isStale = draftKey != null && activeDraftKey !== draftKey;
  const toolbarPresetId = isGeneratedLayout ? GENERATED_PRESET_ID : activePresetId;
  const presets = useMemo(
    () =>
      isGeneratedLayout
        ? [
            ...DOCUMENT_DESIGNER_LAYOUT_PRESETS,
            { id: GENERATED_PRESET_ID, label: "Auto-generated", description: "Randomized layout" },
          ]
        : DOCUMENT_DESIGNER_LAYOUT_PRESETS,
    [isGeneratedLayout]
  );

  const pageDimensions = useMemo(
    () => presentationPagePreviewDimensions(shellConfig.page.size, shellConfig.page.orientation),
    [shellConfig.page.orientation, shellConfig.page.size]
  );

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Live preview
          </p>
          <p className="text-[10px] text-muted-foreground">
            Sample data
            {pageDimensions ? ` · ${pageDimensions.label} ${shellConfig.page.orientation}` : ""}
          </p>
        </div>
        <DocumentDesignerPreviewToolbar
          presets={presets}
          activePresetId={toolbarPresetId}
          pageSize={shellConfig.page.size}
          canEdit={canEdit}
          isPending={isPending}
          onSelectPreset={onSelectPreset}
          onPreviousPreset={onPreviousPreset}
          onNextPreset={onNextPreset}
          onPageSizeChange={onPageSizeChange}
          onAutoGenerate={onAutoGenerate}
          onRefresh={() => {
            if (draftKey) setActiveDraftKey(draftKey);
            setRefreshNonce((value) => value + 1);
          }}
        />
      </div>
      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-auto bg-muted/35 p-4 sm:p-6",
          isPending && "opacity-90"
        )}
      >
        {isStale ? (
          <div className="absolute right-3 top-3 z-10 rounded-md border border-border/60 bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
            Pending changes…
          </div>
        ) : null}
        {previewHtml ? (
          <div
            className="mx-auto max-w-full bg-white shadow-md ring-1 ring-border/40"
            style={{
              width: pageDimensions.width,
              minHeight: pageDimensions.minHeight,
            }}
          >
            <iframe
              title="Document designer preview"
              srcDoc={previewHtml}
              className="block w-full border-0 bg-white"
              style={{ minHeight: pageDimensions.minHeight }}
              sandbox=""
            />
          </div>
        ) : (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
            {previewError ? (
              <p className="text-destructive">{previewError}</p>
            ) : shellLoadError ? (
              <p>{shellLoadError}</p>
            ) : (
              "Preparing preview…"
            )}
          </div>
        )}
      </div>
    </div>
  );
}
