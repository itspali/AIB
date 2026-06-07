"use client";

import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EditorStage } from "@/lib/products/editor-stages";
import type { StageStatus } from "@/lib/products/item-completeness";
import {
  editorPageSectionClass,
  editorPanelSectionClass,
} from "@/lib/products/editor-chrome";

function statusDotClass(status: StageStatus, expanded: boolean): string {
  if (expanded) return "border-primary bg-primary text-primary-foreground";
  switch (status) {
    case "error":
      return "border-destructive bg-destructive/10 text-destructive";
    case "complete":
      return "border-emerald-500 bg-emerald-500 text-white";
    case "partial":
      return "border-primary/50 bg-primary/10 text-primary";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

type Props = {
  stage: EditorStage;
  index: number;
  status: StageStatus;
  expanded: boolean;
  onToggle: () => void;
  registerRef?: (el: HTMLDivElement | null) => void;
  panel?: boolean;
};

export function EditorStageAccordionHeader({
  stage,
  index,
  status,
  expanded,
  onToggle,
  registerRef,
  panel = false,
}: Props) {
  return (
    <div
      ref={registerRef}
      data-wizard-stage={stage.id}
      className={cn("mb-2 scroll-mt-16", panel && "scroll-mt-12")}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          panel ? editorPanelSectionClass() : editorPageSectionClass("section"),
          "flex w-full items-center gap-3 text-left transition-colors hover:bg-muted/30"
        )}
      >
        <span
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
            statusDotClass(status, expanded)
          )}
        >
          {status === "complete" && !expanded ? (
            <Check className="h-3.5 w-3.5" aria-hidden />
          ) : (
            index + 1
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">{stage.label}</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">{stage.description}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180"
          )}
          aria-hidden
        />
      </button>
    </div>
  );
}
