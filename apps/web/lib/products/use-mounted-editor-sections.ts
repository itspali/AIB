"use client";

import { useCallback, useEffect, useState } from "react";
import { editorStageById, type EditorStageId } from "@/lib/products/editor-stages";
import type { EditorSectionId } from "@/lib/products/editor-sections";

const DEFAULT_MOUNTED: EditorSectionId[] = ["overview"];

/**
 * Defers mounting heavy section subtrees until the user navigates to them
 * (scroll-spy or section nav). Reduces initial edit-form cost and focus lag.
 */
export function useMountedEditorSections(
  activeSection: EditorSectionId,
  options?: { wizardStage?: EditorStageId | null }
) {
  const [mounted, setMounted] = useState<Set<EditorSectionId>>(
    () => new Set(DEFAULT_MOUNTED)
  );

  useEffect(() => {
    setMounted((prev) => {
      const toAdd: EditorSectionId[] = options?.wizardStage
        ? [...editorStageById(options.wizardStage).sections]
        : [activeSection];

      let changed = false;
      const next = new Set(prev);
      for (const id of toAdd) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [activeSection, options?.wizardStage]);

  const isSectionMounted = useCallback((id: EditorSectionId) => mounted.has(id), [mounted]);

  return isSectionMounted;
}
