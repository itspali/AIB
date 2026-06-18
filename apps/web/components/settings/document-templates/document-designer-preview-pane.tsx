"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { DocumentDesignerLivePreview } from "@/components/settings/document-templates/document-designer-live-preview";
import type { DocumentLayoutScope } from "@/lib/documents/layout-scope";
import type { DesignerLayoutBundle } from "@/lib/documents/print/document-designer-layout-presets";
import type {
  PresentationPageSize,
  PresentationShellConfig,
  PresentationStyleConfig,
  PresentationViewContext,
} from "@/lib/documents/print/types";
import type { DocumentLayoutTemplate, DocumentModuleKey } from "@/lib/documents/types";

const GENERATED_PRESET_ID = "generated";

function layoutsEqual(left: DocumentLayoutTemplate, right: DocumentLayoutTemplate): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function layoutWithoutTypography(layout: DocumentLayoutTemplate): DocumentLayoutTemplate {
  return {
    ...layout,
    columns: layout.columns.map(
      ({ typography: _typography, labelTypography: _labelTypography, valueTypography: _valueTypography, ...column }) =>
        column
    ),
  };
}

function layoutStructureEqual(left: DocumentLayoutTemplate, right: DocumentLayoutTemplate): boolean {
  return JSON.stringify(layoutWithoutTypography(left)) === JSON.stringify(layoutWithoutTypography(right));
}

type Props = {
  layoutDraftListenerRef: MutableRefObject<(layout: DocumentLayoutTemplate) => void>;
  syncLayout: DocumentLayoutTemplate;
  syncLayoutRevision: number;
  moduleKey: DocumentModuleKey;
  viewContext: PresentationViewContext;
  scope: DocumentLayoutScope;
  shellConfig: PresentationShellConfig;
  styleConfig: PresentationStyleConfig;
  shellLoadError?: string | null;
  canEdit: boolean;
  appliedPresetId: string;
  previewPresetId: string;
  previewBundleOverride: DesignerLayoutBundle | null;
  isGeneratedLayout: boolean;
  activePresetId: string;
  onPreviewPresetIdChange: (presetId: string) => void;
  onSelectPreset: (presetId: string) => void;
  onApplyPreviewPreset: () => void;
  onPreviousPreset: () => void;
  onNextPreset: () => void;
  onPageSizeChange: (size: PresentationPageSize) => void;
  onAutoGenerate: () => void;
  seededPreviewDraftKey?: string | null;
  seededPreviewHtml?: string | null;
};

export function DocumentDesignerPreviewPane({
  layoutDraftListenerRef,
  syncLayout,
  syncLayoutRevision,
  activePresetId,
  isGeneratedLayout,
  onPreviewPresetIdChange,
  ...previewProps
}: Props) {
  const [previewLayout, setPreviewLayout] = useState(syncLayout);
  const appliedSyncRevisionRef = useRef(syncLayoutRevision);
  const draftEditPendingPresetSyncRef = useRef(false);

  useEffect(() => {
    layoutDraftListenerRef.current = (next) => {
      setPreviewLayout((current) => {
        if (layoutsEqual(current, next)) return current;
        if (!layoutStructureEqual(current, next)) {
          draftEditPendingPresetSyncRef.current = true;
        }
        return next;
      });
    };
    return () => {
      layoutDraftListenerRef.current = () => {};
    };
  }, [layoutDraftListenerRef]);

  useEffect(() => {
    if (!draftEditPendingPresetSyncRef.current) return;
    draftEditPendingPresetSyncRef.current = false;
    onPreviewPresetIdChange(isGeneratedLayout ? GENERATED_PRESET_ID : activePresetId);
  }, [previewLayout, activePresetId, isGeneratedLayout, onPreviewPresetIdChange]);

  useEffect(() => {
    if (appliedSyncRevisionRef.current === syncLayoutRevision) return;
    appliedSyncRevisionRef.current = syncLayoutRevision;
    setPreviewLayout(syncLayout);
  }, [syncLayout, syncLayoutRevision]);

  return (
    <DocumentDesignerLivePreview
      {...previewProps}
      isGeneratedLayout={isGeneratedLayout}
      layout={previewLayout}
    />
  );
}
