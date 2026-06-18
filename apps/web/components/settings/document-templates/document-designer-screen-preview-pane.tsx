"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { DocumentLayoutPreview } from "@/components/settings/document-layout/document-layout-preview";
import { DocumentLayoutSimplePreview } from "@/components/settings/document-layout/document-layout-simple-preview";
import type { DocumentLayoutTemplate, DocumentModuleKey } from "@/lib/documents/types";

function layoutsEqual(left: DocumentLayoutTemplate, right: DocumentLayoutTemplate): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

type Props = {
  moduleKey: DocumentModuleKey;
  layoutDraftListenerRef: MutableRefObject<(layout: DocumentLayoutTemplate) => void>;
  syncLayout: DocumentLayoutTemplate;
  syncLayoutRevision: number;
};

export function DocumentDesignerScreenPreviewPane({
  moduleKey,
  layoutDraftListenerRef,
  syncLayout,
  syncLayoutRevision,
}: Props) {
  const [previewLayout, setPreviewLayout] = useState(syncLayout);
  const [previewMode, setPreviewMode] = useState<"drawer" | "peek">("drawer");
  const appliedSyncRevisionRef = useRef(syncLayoutRevision);

  useEffect(() => {
    layoutDraftListenerRef.current = (next) => {
      setPreviewLayout((current) => (layoutsEqual(current, next) ? current : next));
    };
    return () => {
      layoutDraftListenerRef.current = () => {};
    };
  }, [layoutDraftListenerRef]);

  useEffect(() => {
    if (appliedSyncRevisionRef.current === syncLayoutRevision) return;
    appliedSyncRevisionRef.current = syncLayoutRevision;
    setPreviewLayout(syncLayout);
  }, [syncLayout, syncLayoutRevision]);

  return (
    <div className="document-designer-preview-panel flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-card">
      <div className="document-designer-preview-header shrink-0 border-b border-border px-3 py-2">
        <div className="min-w-0 shrink-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Live preview
          </p>
          <p className="text-[10px] text-muted-foreground">Sample data · On-screen drawer and peek</p>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-auto bg-muted/35 p-4 sm:p-6">
        <div className="mx-auto w-full max-w-full min-w-0">
          {moduleKey === "PURCHASE_ORDER" ? (
            <DocumentLayoutPreview
              layout={previewLayout}
              previewMode={previewMode}
              onPreviewModeChange={setPreviewMode}
            />
          ) : (
            <DocumentLayoutSimplePreview
              layout={previewLayout}
              previewMode={previewMode}
              onPreviewModeChange={setPreviewMode}
            />
          )}
        </div>
      </div>
    </div>
  );
}
