"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { FilterChipRow } from "@/components/search/filter-chip-row";
import { Omnibar } from "@/components/search/omnibar";
import { useOmnibarContext } from "@/components/search/omnibar-provider";
import { getScopeLabel } from "@/lib/search/scopes";
import { Button } from "@/components/ui/button";

function ShortcutKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="ml-1.5 inline-flex items-center rounded border border-border/80 bg-background/50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
      {children}
    </kbd>
  );
}

function useApplyShortcutLabel() {
  const [label, setLabel] = useState("Ctrl+↵");

  useEffect(() => {
    const isApple = /Mac|iPhone|iPad/i.test(navigator.userAgent);
    setLabel(isApple ? "⌘↵" : "Ctrl+↵");
  }, []);

  return label;
}

export function OmnibarCommandDialog() {  const {
    commandOpen,
    scope,
    focusInput,
    modalDraftAst,
    removeDraftCriterionAt,
    clearModalDraft,
    applyModalFilters,
    cancelCommandPalette,
    canApplyModal,
    isExecuting,
  } = useOmnibarContext();

  const applyShortcutLabel = useApplyShortcutLabel();
  const draftChips = modalDraftAst.filter((clause) => clause.kind !== "text");
  useEffect(() => {
    if (!commandOpen) return;
    const id = window.requestAnimationFrame(() => focusInput());
    return () => window.cancelAnimationFrame(id);
  }, [commandOpen, focusInput]);

  useEffect(() => {
    if (!commandOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        cancelCommandPalette();
        return;
      }

      if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        event.stopPropagation();
        if (canApplyModal && !isExecuting) {
          applyModalFilters();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [commandOpen, cancelCommandPalette, applyModalFilters, canApplyModal, isExecuting]);

  if (!commandOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 pt-[max(1rem,env(safe-area-inset-top))] md:pt-[8vh]"
      role="presentation"
    >
      <div
        className="flex max-h-[min(85vh,640px)] min-h-[min(520px,85vh)] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl shadow-primary/10 backdrop-blur-xl"
        role="dialog"
        aria-label="Search and filter"
        aria-modal="true"
      >
        <div className="shrink-0 border-b border-border bg-gradient-to-r from-primary/10 via-transparent to-accent/10 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-sm font-medium">Search & filter</span>
              <span className="truncate text-xs text-muted-foreground">
                · {getScopeLabel(scope)}
              </span>
            </div>
            {draftChips.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 text-xs text-muted-foreground"
                onClick={clearModalDraft}
              >
                Clear draft
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-[120px] shrink-0 overflow-y-auto border-b border-border/60 bg-muted/20 px-4 py-3">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Criteria to apply ({draftChips.length})
            </p>
            {draftChips.length > 0 ? (
              <FilterChipRow ast={modalDraftAst} onRemove={removeDraftCriterionAt} />
            ) : (
              <p className="text-xs text-muted-foreground">
                No criteria yet. Add filters below, then click Apply.
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            <Omnibar variant="dialog" />
          </div>
        </div>

        <div className="shrink-0 border-t border-border/60 bg-card/95 px-4 py-3">
          <p className="mb-3 text-xs text-muted-foreground">
            ↑↓ suggestions · Enter to insert or add criterion · Ctrl+Enter to apply
          </p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={cancelCommandPalette}>
              Cancel
              <ShortcutKey>Esc</ShortcutKey>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={applyModalFilters}
              disabled={!canApplyModal || isExecuting}
            >
              {isExecuting ? "Applying…" : "Apply"}
              {!isExecuting ? <ShortcutKey>{applyShortcutLabel}</ShortcutKey> : null}
            </Button>          </div>
        </div>
      </div>
    </div>
  );
}
