"use client";

import { useCallback, useState, useTransition } from "react";
import { Copy, FilterX, Save } from "lucide-react";
import { toast } from "sonner";
import {
  listCustomModuleViews,
  saveCustomModuleView,
  updateCustomModuleView,
} from "@/app/search/views/actions";
import { FilterChipRow } from "@/components/search/filter-chip-row";
import { SaveViewSheet } from "@/components/search/save-view-sheet";
import { useOmnibarContext } from "@/components/search/omnibar-provider";
import { Button } from "@/components/ui/button";
import {
  getModuleViewDefinition,
  isSavedViewsScope,
} from "@/lib/search/views/module-view-registry";
import {
  buildCopyViewName,
  extractStructuralAst,
} from "@/lib/search/views/saved-view-utils";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  wrapperClassName?: string;
  variant?: "header" | "inline";
};

const filterActionIconButtonClass =
  "h-8 w-8 shrink-0 p-0 focus-visible:ring-1 focus-visible:ring-ring";

export function OmnibarFilterChipBar({
  className,
  wrapperClassName,
  variant = "header",
}: Props) {
  const {
    activeAst,
    removeClauseAt,
    activeFilterCount,
    clearFilters,
    scope,
    appliedQuery,
    permissions,
    activeSavedViewId,
    activeSavedView,
    isSavedViewDirty,
    setActiveSavedViewSnapshot,
    notifySavedViewsChanged,
    refreshSearchPermissions,
  } = useOmnibarContext();

  const [saveOpen, setSaveOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const chips = activeAst.filter((clause) => clause.kind !== "text");
  const canManageViews =
    isSavedViewsScope(scope) &&
    activeFilterCount > 0 &&
    appliedQuery.trim().length > 0 &&
    !permissions?.throttled;

  const moduleDef = getModuleViewDefinition(scope);

  const persistActiveViewUpdate = useCallback(() => {
    if (!activeSavedView) return;
    const trimmedQuery = appliedQuery.trim();
    if (!trimmedQuery) return;

    startTransition(async () => {
      const result = await updateCustomModuleView({
        id: activeSavedView.id,
        rawSearchText: trimmedQuery,
        compiledAst: extractStructuralAst(activeAst),
      });

      if (!result.ok) {
        toast.error(result.error ?? "Unable to update view.");
        return;
      }
      if (!result.view) {
        toast.error("Unable to update view.");
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
      toast.success(`"${result.view.view_name}" updated.`);
    });
  }, [
    activeAst,
    activeSavedView,
    appliedQuery,
    notifySavedViewsChanged,
    setActiveSavedViewSnapshot,
  ]);

  const persistSaveAsNew = useCallback(() => {
    if (!moduleDef || !activeSavedView) return;
    const trimmedQuery = appliedQuery.trim();
    if (!trimmedQuery) return;

    startTransition(async () => {
      const listResult = await listCustomModuleViews(moduleDef.moduleName);
      const existingNames =
        listResult.ok && listResult.views
          ? listResult.views.map((view) => view.view_name)
          : [];
      const viewName = buildCopyViewName(activeSavedView.view_name, existingNames);

      const result = await saveCustomModuleView({
        moduleName: moduleDef.moduleName,
        viewName,
        rawSearchText: trimmedQuery,
        compiledAst: extractStructuralAst(activeAst),
      });

      if (!result.ok) {
        toast.error(result.error ?? "Unable to save view.");
        return;
      }
      if (!result.view) {
        toast.error("Unable to save view.");
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
      toast.success(`Saved as "${result.view.view_name}".`);
    });
  }, [
    activeAst,
    activeSavedView,
    appliedQuery,
    moduleDef,
    notifySavedViewsChanged,
    setActiveSavedViewSnapshot,
  ]);

  if (!chips.length && !permissions?.throttled) return null;

  return (
    <>
      <div
        className={cn(
          variant === "header"
            ? "border-t border-border/60 px-4 py-1.5 md:px-6"
            : "py-0.5",
          wrapperClassName
        )}
      >
        {permissions?.throttled ? (
          <div
            className={cn(
              "mb-1.5 flex w-full flex-wrap items-center gap-2 text-xs text-amber-700 dark:text-amber-300",
              variant === "header" && "mx-auto max-w-2xl"
            )}
          >
            <p>
              Native structural filters are temporarily restricted on this account. Use text search
              only, or restore native filters below.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 shrink-0 border-amber-500/40 text-xs"
              onClick={() => void refreshSearchPermissions()}
            >
              Restore native filters
            </Button>
          </div>
        ) : null}

        <div
          className={cn(
            "flex min-h-8 w-full items-center gap-2",
            variant === "header" && "mx-auto max-w-2xl",
            className
          )}
        >
          <span className="shrink-0 text-xs font-medium text-muted-foreground">
            Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </span>
          {chips.length > 0 ? (
            <FilterChipRow
              ast={activeAst}
              onRemove={removeClauseAt}
              className="min-w-0 flex-1"
            />
          ) : (
            <div className="min-w-0 flex-1" />
          )}

          <div className="flex shrink-0 items-center gap-0.5">
            {canManageViews && activeSavedViewId && !isSavedViewDirty ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={filterActionIconButtonClass}
                disabled={isPending}
                onClick={persistActiveViewUpdate}
                title="Update view"
                aria-label="Update view"
              >
                <Save className="h-4 w-4" />
              </Button>
            ) : null}
            {canManageViews && activeSavedViewId && isSavedViewDirty ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className={filterActionIconButtonClass}
                disabled={isPending}
                onClick={persistActiveViewUpdate}
                title="Save changes"
                aria-label="Save changes"
              >
                <Save className="h-4 w-4" />
              </Button>
            ) : null}
            {canManageViews && !activeSavedViewId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={filterActionIconButtonClass}
                onClick={() => setSaveOpen(true)}
                title="Save view"
                aria-label="Save view"
              >
                <Save className="h-4 w-4" />
              </Button>
            ) : null}
            {canManageViews && activeSavedViewId ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={filterActionIconButtonClass}
                disabled={isPending}
                onClick={persistSaveAsNew}
                title="Save as new"
                aria-label="Save as new"
              >
                <Copy className="h-4 w-4" />
              </Button>
            ) : null}
            {chips.length > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(filterActionIconButtonClass, "text-muted-foreground")}
                onClick={clearFilters}
                disabled={isPending}
                title="Clear all filters"
                aria-label="Clear all filters"
              >
                <FilterX className="h-4 w-4" />
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
