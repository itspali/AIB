"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateCustomModuleView } from "@/app/search/views/actions";
import { FilterChipRow } from "@/components/search/filter-chip-row";
import { SaveViewSheet } from "@/components/search/custom-view-sidebar";
import { useOmnibarContext } from "@/components/search/omnibar-provider";
import { Button } from "@/components/ui/button";
import { isSavedViewsScope } from "@/lib/search/views/module-view-registry";
import { extractStructuralAst } from "@/lib/search/views/saved-view-utils";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  wrapperClassName?: string;
};

export function OmnibarFilterChipBar({ className, wrapperClassName }: Props) {
  const {
    activeAst,
    removeClauseAt,
    activeFilterCount,
    clearFilters,
    scope,
    appliedQuery,
    permissions,
    activeSavedViewId,
    isSavedViewDirty,
    setActiveSavedViewSnapshot,
    notifySavedViewsChanged,
  } = useOmnibarContext();

  const [saveOpen, setSaveOpen] = useState(false);
  const [isUpdating, startUpdateTransition] = useTransition();

  const chips = activeAst.filter((clause) => clause.kind !== "text");
  const canManageViews = isSavedViewsScope(scope) && activeFilterCount > 0 && appliedQuery.trim().length > 0;

  const handleUpdateView = () => {
    if (!activeSavedViewId) return;

    startUpdateTransition(async () => {
      const result = await updateCustomModuleView({
        id: activeSavedViewId,
        rawSearchText: appliedQuery.trim(),
        compiledAst: extractStructuralAst(activeAst),
      });

      if (!result.ok || !result.view) {
        toast.error(result.error ?? "Unable to update view.");
        return;
      }

      setActiveSavedViewSnapshot({
        id: result.view.id,
        module_name: result.view.module_name,
        view_name: result.view.view_name,
        raw_search_text: result.view.raw_search_text,
        compiled_ast: result.view.compiled_ast,
      });
      notifySavedViewsChanged();
      toast.success("View updated.");
    });
  };

  if (!chips.length && !permissions?.throttled) return null;

  return (
    <>
      <div className={cn("border-t border-border/60 px-4 py-1.5 md:px-6", wrapperClassName)}>
        {permissions?.throttled ? (
          <p className="mx-auto mb-1.5 w-full max-w-2xl text-xs text-amber-700 dark:text-amber-300">
            Native structural filters are temporarily restricted on this account. Use text search
            only until the session refreshes.
          </p>
        ) : null}

        <div
          className={cn(
            "mx-auto flex min-h-8 w-full max-w-2xl items-center justify-between gap-3",
            className
          )}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Active filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </span>
            {chips.length > 0 ? (
              <FilterChipRow ast={activeAst} onRemove={removeClauseAt} className="min-w-0 flex-1" />
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {canManageViews && isSavedViewDirty && activeSavedViewId ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 shrink-0 text-xs"
                disabled={isUpdating}
                onClick={handleUpdateView}
              >
                Update view
              </Button>
            ) : null}
            {canManageViews && !activeSavedViewId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 text-xs"
                onClick={() => setSaveOpen(true)}
              >
                Save view
              </Button>
            ) : null}
            {canManageViews && activeSavedViewId && !isSavedViewDirty ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 shrink-0 text-xs"
                onClick={() => setSaveOpen(true)}
              >
                Save as new
              </Button>
            ) : null}
            {chips.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 text-xs text-muted-foreground"
                onClick={clearFilters}
              >
                Clear all
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <SaveViewSheet
        open={saveOpen}
        onOpenChange={setSaveOpen}
        onSaved={() => notifySavedViewsChanged()}
      />
    </>
  );
}
