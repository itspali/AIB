"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { loadDocumentDesignerPreview } from "@/app/settings/documents/templates/actions";
import { DocumentDesignerPreviewToolbar } from "@/components/settings/document-templates/document-designer-preview-toolbar";
import { layoutScopeKey, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
import { DOCUMENT_DESIGNER_LAYOUT_PRESETS } from "@/lib/documents/print/document-designer-layout-presets";
import type { PresentationShellConfig, PresentationViewContext } from "@/lib/documents/print/types";
import type { DocumentLayoutTemplate, DocumentModuleKey } from "@/lib/documents/types";
import { cn } from "@/lib/utils";

const PREVIEW_DEBOUNCE_MS = 800;
const GENERATED_PRESET_ID = "generated";

type Props = {
  moduleKey: DocumentModuleKey;
  viewContext: PresentationViewContext;
  scope: DocumentLayoutScope;
  layout: DocumentLayoutTemplate | null;
  shellConfig: PresentationShellConfig | null;
  canEdit: boolean;
  activePresetId: string;
  isGeneratedLayout: boolean;
  onSelectPreset: (presetId: string) => void;
  onPreviousPreset: () => void;
  onNextPreset: () => void;
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
  canEdit,
  activePresetId,
  isGeneratedLayout,
  onSelectPreset,
  onPreviousPreset,
  onNextPreset,
  onAutoGenerate,
}: Props) {
  const [previewHtml, setPreviewHtml] = useState("");
  const [isPending, startTransition] = useTransition();
  const [refreshNonce, setRefreshNonce] = useState(0);
  const requestIdRef = useRef(0);

  const scopeKey = layoutScopeKey(scope);
  const structuralKey = `${moduleKey}:${viewContext}:${scopeKey}`;
  const prevStructuralKeyRef = useRef(structuralKey);

  const draftKey = useMemo(() => {
    if (!layout || !shellConfig) return null;
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
    if (!layout || !shellConfig || !activeDraftKey) return;

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
        setPreviewHtml(result.html);
      }
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

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card">
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Live preview
          </p>
          <p className="text-[10px] text-muted-foreground">
            Sample data · layout presets apply fields and appearance together
          </p>
        </div>
        <DocumentDesignerPreviewToolbar
          presets={presets}
          activePresetId={toolbarPresetId}
          canEdit={canEdit}
          isPending={isPending}
          onSelectPreset={onSelectPreset}
          onPreviousPreset={onPreviousPreset}
          onNextPreset={onNextPreset}
          onAutoGenerate={onAutoGenerate}
          onRefresh={() => {
            if (draftKey) setActiveDraftKey(draftKey);
            setRefreshNonce((value) => value + 1);
          }}
        />
      </div>
      <div
        className={cn(
          "relative min-h-0 flex-1 overflow-auto bg-white",
          isPending && "opacity-90"
        )}
      >
        {isStale ? (
          <div className="absolute right-3 top-3 z-10 rounded-md border border-border/60 bg-background/90 px-2 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
            Pending changes…
          </div>
        ) : null}
        {previewHtml ? (
          <iframe
            title="Document designer preview"
            srcDoc={previewHtml}
            className="h-full min-h-[min(85vh,960px)] w-full border-0 bg-white"
            sandbox=""
          />
        ) : (
          <div className="flex h-full min-h-[360px] items-center justify-center text-sm text-muted-foreground">
            {layout && shellConfig ? "Preparing preview…" : "Loading template…"}
          </div>
        )}
      </div>
    </div>
  );
}
