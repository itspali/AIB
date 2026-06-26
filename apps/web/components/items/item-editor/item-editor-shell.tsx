"use client";

import type { ReactNode } from "react";
import { MutationGlassRoot } from "@/components/layout/mutation-form/mutation-glass-root";
import { editorStageById, type EditorStageId } from "@/lib/products/editor-stages";
import type { WizardLayout } from "@/components/products/product-editor/product-editor-shell";
import { cn } from "@/lib/utils";

type Props = {
  stage: EditorStageId;
  layout?: WizardLayout;
  children: ReactNode;
  className?: string;
};

/**
 * Glass V2 scope for the item create/edit wizard — wraps ProductEditorShell
 * while stages are split out incrementally from the monolith.
 */
export function ItemEditorShell({ stage, layout = "steps", children, className }: Props) {
  const stageMeta = editorStageById(stage);
  const showStageIntent = layout === "steps";

  return (
    <MutationGlassRoot
      className={cn(
        "item-editor-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        className
      )}
    >
      {showStageIntent ? (
        <header className="shrink-0 space-y-0.5 px-3 pt-1">
          <p className="text-xs leading-relaxed text-muted-foreground">{stageMeta.description}</p>
        </header>
      ) : null}
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </MutationGlassRoot>
  );
}
