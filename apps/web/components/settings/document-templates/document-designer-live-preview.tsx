"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { loadDocumentDesignerPreview } from "@/app/settings/documents/templates/actions";
import { DocumentDesignerPreviewToolbar } from "@/components/settings/document-templates/document-designer-preview-toolbar";
import { layoutScopeKey, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
import { DOCUMENT_DESIGNER_LAYOUT_PRESETS } from "@/lib/documents/print/document-designer-layout-presets";
import {
  buildDesignerPreviewDraftKey,
  type DesignerPreviewDraftInput,
} from "@/lib/documents/print/designer-preview-draft";
import {
  getCachedDesignerPreview,
  invalidateDesignerPreviewCache,
  requestCachedDesignerPreview,
  seedDesignerPreviewCache,
} from "@/lib/documents/print/designer-preview-request-cache";
import { presentationPagePreviewDimensions } from "@/lib/documents/print/presentation-page-dimensions";
import type {
  PresentationPageSize,
  PresentationShellConfig,
  PresentationStyleConfig,
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
  styleConfig: PresentationStyleConfig;
  shellLoadError?: string | null;
  canEdit: boolean;
  activePresetId: string;
  isGeneratedLayout: boolean;
  seededPreviewDraftKey?: string | null;
  seededPreviewHtml?: string | null;
  onSelectPreset: (presetId: string) => void;
  onPreviousPreset: () => void;
  onNextPreset: () => void;
  onPageSizeChange: (size: PresentationPageSize) => void;
  onAutoGenerate: () => void;
};

type PreviewDraft = DesignerPreviewDraftInput;

function previewDraftKey(draft: PreviewDraft): string {
  return buildDesignerPreviewDraftKey(draft);
}

export function DocumentDesignerLivePreview({
  moduleKey,
  viewContext,
  scope,
  layout,
  shellConfig,
  styleConfig,
  shellLoadError,
  canEdit,
  activePresetId,
  isGeneratedLayout,
  seededPreviewDraftKey = null,
  seededPreviewHtml = null,
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
  const committedDraftRef = useRef<PreviewDraft | null>(null);
  const currentDraftRef = useRef<PreviewDraft | null>(null);

  const scopeKey = layoutScopeKey(scope);
  const structuralKey = `${moduleKey}:${viewContext}:${scopeKey}`;

  const currentDraft = useMemo<PreviewDraft>(
    () => ({
      moduleKey,
      viewContext,
      scope,
      layout: {
        ...layout,
        moduleKey,
        viewContext,
      },
      shellConfig,
      styleConfig,
    }),
    [moduleKey, viewContext, scope, layout, shellConfig, styleConfig]
  );

  currentDraftRef.current = currentDraft;

  const draftKey = useMemo(() => previewDraftKey(currentDraft), [currentDraft]);

  const [activeDraftKey, setActiveDraftKey] = useState<string | null>(null);
  const seededPreviewRef = useRef(seededPreviewDraftKey);

  useEffect(() => {
    if (
      !seededPreviewDraftKey ||
      !seededPreviewHtml ||
      seededPreviewRef.current !== seededPreviewDraftKey
    ) {
      return;
    }
    seededPreviewRef.current = null;
    seedDesignerPreviewCache(seededPreviewDraftKey, { html: seededPreviewHtml });
    committedDraftRef.current = currentDraftRef.current;
    setPreviewError(null);
    setPreviewHtml(seededPreviewHtml);
    setActiveDraftKey((current) =>
      current === seededPreviewDraftKey ? current : seededPreviewDraftKey
    );
  }, [seededPreviewDraftKey, seededPreviewHtml]);

  useEffect(() => {
    if (!draftKey) {
      setActiveDraftKey(null);
      committedDraftRef.current = null;
      return;
    }

    const cached = getCachedDesignerPreview(draftKey);
    if (cached) {
      committedDraftRef.current = currentDraftRef.current;
      setActiveDraftKey((current) => (current === draftKey ? current : draftKey));
      if ("html" in cached) {
        setPreviewError(null);
        setPreviewHtml(cached.html);
      } else {
        setPreviewError(cached.error);
      }
      return;
    }

    const timer = window.setTimeout(() => {
      committedDraftRef.current = currentDraftRef.current;
      setActiveDraftKey((current) => (current === draftKey ? current : draftKey));
    }, PREVIEW_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [draftKey, structuralKey]);

  useEffect(() => {
    const draft = committedDraftRef.current;
    if (!activeDraftKey || !draft) return;

    const cached = getCachedDesignerPreview(activeDraftKey);
    if (cached) {
      if ("html" in cached) {
        setPreviewError(null);
        setPreviewHtml(cached.html);
      } else {
        setPreviewError(cached.error);
      }
      return;
    }

    const requestId = ++requestIdRef.current;
    startTransition(async () => {
      const result = await requestCachedDesignerPreview(activeDraftKey, () =>
        loadDocumentDesignerPreview({
          moduleKey: draft.moduleKey,
          viewContext: draft.viewContext,
          scope: draft.scope,
          shellConfig: draft.shellConfig,
          styleConfig: draft.styleConfig,
          layout: draft.layout,
        })
      );

      if (requestId !== requestIdRef.current) return;
      if ("html" in result) {
        setPreviewError(null);
        setPreviewHtml(result.html);
        return;
      }
      setPreviewError(result.error);
    });
  }, [activeDraftKey, refreshNonce]);

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
    <div className="document-designer-preview-panel flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card">
      <div className="document-designer-preview-header shrink-0 border-b border-border px-3 py-2">
        <div className="min-w-0 shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Live preview
          </p>
          <p className="text-[10px] text-muted-foreground">
            Sample data
            {pageDimensions ? ` · ${pageDimensions.label} ${shellConfig.page.orientation}` : ""}
          </p>
        </div>
        <div className="document-designer-preview-header__toolbar">
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
            if (draftKey) invalidateDesignerPreviewCache(draftKey);
            committedDraftRef.current = currentDraftRef.current;
            if (draftKey) setActiveDraftKey(draftKey);
            setRefreshNonce((value) => value + 1);
          }}
          />
        </div>
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
            className="mx-auto w-full overflow-hidden bg-white shadow-md ring-1 ring-border/40"
            style={{
              width: pageDimensions.width,
              maxWidth: "100%",
              aspectRatio: pageDimensions.aspectRatio,
            }}
          >
            <iframe
              title="Document designer preview"
              srcDoc={previewHtml}
              className="block h-full w-full border-0 bg-white"
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
