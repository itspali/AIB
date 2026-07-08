"use client";

import type { ReactNode } from "react";
import { MutationGlassRoot } from "@/components/layout/mutation-form/mutation-glass-root";
import { EditorGlassSectionsProvider } from "@/lib/products/editor-chrome";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
};

/**
 * Glass V2 scope for the item create/edit wizard — wraps ProductEditorShell
 * while stages are split out incrementally from the monolith.
 */
export function ItemEditorShell({ children, className }: Props) {
  return (
    <MutationGlassRoot
      className={cn(
        "item-editor-shell flex h-full min-h-0 flex-1 flex-col overflow-hidden",
        className
      )}
    >
      <EditorGlassSectionsProvider>{children}</EditorGlassSectionsProvider>
    </MutationGlassRoot>
  );
}
