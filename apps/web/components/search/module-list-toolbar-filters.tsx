"use client";

import { useCallback, useState, useTransition, type ReactNode } from "react";
import { Copy, Filter, FilterX, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  listCustomModuleViews,
  updateCustomModuleView,
} from "@/app/search/views/actions";
import { FilterChipRow } from "@/components/search/filter-chip-row";
import { SaveViewSheet } from "@/components/search/save-view-sheet";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getModuleViewDefinition,
  isSavedViewsScope,
} from "@/lib/search/views/module-view-registry";
import {
  buildCopyViewName,
  extractStructuralAst,
} from "@/lib/search/views/saved-view-utils";
import {
  listToolbarIconButtonClass,
  LIST_TOOLBAR_CONTROL_HEIGHT,
  LIST_TOOLBAR_TEXT,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

export type ModuleListToolbarFilterExtras = {
  extraFilterCount: number;
  extraDropdownContent: ReactNode;
  onClearExtras: () => void;
};

type Props = {
  extras?: ModuleListToolbarFilterExtras;
};

export function ModuleListToolbarFilters({ extras }: Props) {
  const omnibar = useOptionalOmnibarContext();
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveDefaultName, setSaveDefaultName] = useState("");
  const [isPending, startTransition] = useTransition();

  const hasOmnibarFilters = omnibar?.hasActiveFilters ?? false;
  const activeSavedView = omnibar?.activeSavedView;
  const activeSavedViewId = omnibar?.activeSavedViewId;
  const isSavedViewDirty = omnibar?.isSavedViewDirty ?? false;
  const viewMatchesFilters =
    activeSavedViewId != null && hasOmnibarFilters && !isSavedViewDirty;
  const activeAst = omnibar?.activeAst ?? [];
  const structuralChips = activeAst.filter((clause) => clause.kind !== "text");
  const textClause = activeAst.find((clause) => clause.kind === "text");
  const textFilterValue =
    textClause?.kind === "text" ? textClause.value.trim() : "";

  const scope = omnibar?.scope;
  const appliedQuery = omnibar?.appliedQuery ?? "";
  const activeFilterCount = omnibar?.activeFilterCount ?? 0;
  const moduleDef = scope ? getModuleViewDefinition(scope) : null;
  const canManageViews =
    scope != null &&
    isSavedViewsScope(scope) &&
    activeFilterCount > 0 &&
    appliedQuery.trim().length > 0 &&
    !omnibar?.permissions?.throttled;

  const extraFilterCount = extras?.extraFilterCount ?? 0;
  const isVisible = hasOmnibarFilters || extraFilterCount > 0;

  const filterCount =
    structuralChips.length +
    (textFilterValue ? 1 : 0) +
    extraFilterCount;

  const persistActiveViewUpdate = useCallback(() => {
    if (!omnibar?.activeSavedView) return;
    const trimmedQuery = appliedQuery.trim();
    if (!trimmedQuery) return;

    startTransition(async () => {
      const result = await updateCustomModuleView({
        id: omnibar.activeSavedView!.id,
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

      omnibar.setActiveSavedViewSnapshot({
        id: result.view.id,
        module_name: result.view.module_name,
        view_name: result.view.view_name,
        raw_search_text: result.view.raw_search_text,
        compiled_ast: result.view.compiled_ast,
      });
      omnibar.notifySavedViewsChanged();
      toast.success(`"${result.view.view_name}" updated.`);
    });
  }, [activeAst, appliedQuery, omnibar]);

  const openSaveAsSheet = useCallback(() => {
    if (!moduleDef) return;

    startTransition(async () => {
      const listResult = await listCustomModuleViews(moduleDef.moduleName);
      const existingNames =
        listResult.ok && listResult.views
          ? listResult.views.map((view) => view.view_name)
          : [];
      const baseName = activeSavedView?.view_name ?? "View";
      setSaveDefaultName(buildCopyViewName(baseName, existingNames));
      setSaveOpen(true);
    });
  }, [activeSavedView?.view_name, moduleDef]);

  if (!isVisible || !omnibar) return null;

  const handleClearAll = () => {
    omnibar.clearFilters();
    if (extraFilterCount > 0) {
      extras?.onClearExtras();
    }
  };

  const handleClearView = () => {
    omnibar.clearFilters();
  };

  const handleSave = () => {
    if (activeSavedViewId) {
      persistActiveViewUpdate();
      return;
    }
    setSaveDefaultName("");
    setSaveOpen(true);
  };

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className={cn(
              listToolbarIconButtonClass(true),
              LIST_TOOLBAR_CONTROL_HEIGHT,
              "shrink-0 gap-1"
            )}
            title={`Active filters (${filterCount})`}
            aria-label={`Active filters (${filterCount})`}
          >
            <Filter className="h-4 w-4 shrink-0" aria-hidden />
            <span className="text-xs font-semibold tabular-nums leading-none">
              {filterCount}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-72 max-w-[min(20rem,calc(100vw-2rem))] p-3"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className={cn("font-medium text-foreground", LIST_TOOLBAR_TEXT)}>
                Active filters
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleClearAll}
              >
                <FilterX className="mr-1 h-3.5 w-3.5" />
                Clear all
              </Button>
            </div>

            {omnibar.permissions?.throttled ? (
              <p className="text-xs leading-snug text-amber-700 dark:text-amber-300">
                Native structural filters are temporarily restricted. Text search still
                applies.
              </p>
            ) : null}

            {viewMatchesFilters && activeSavedView ? (
              <div className="flex items-center gap-2 rounded-md border border-border/80 bg-muted/40 px-2 py-1.5">
                <span className={cn("min-w-0 flex-1 truncate", LIST_TOOLBAR_TEXT)}>
                  <span className="text-muted-foreground">View · </span>
                  <span className="font-medium text-foreground">
                    {activeSavedView.view_name}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={handleClearView}
                  className="shrink-0 rounded-sm p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  aria-label={`Clear view ${activeSavedView.view_name}`}
                  title="Clear view"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            {structuralChips.length > 0 ? (
              <FilterChipRow
                ast={activeAst}
                onRemove={omnibar.removeClauseAt}
                className="gap-1.5"
              />
            ) : null}

            {textFilterValue ? (
              <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-0.5 pl-2 pr-1 text-[11px] text-primary">
                <span className="truncate">
                  <span className="font-semibold uppercase tracking-wide">Text · </span>
                  {textFilterValue}
                </span>
                <button
                  type="button"
                  onClick={handleClearView}
                  className="shrink-0 rounded-full p-0.5 text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary"
                  aria-label="Clear text filter"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}

            {extras?.extraDropdownContent}

            {canManageViews ? (
              <div className="flex flex-wrap items-center gap-1 border-t border-border/60 pt-2">
                <Button
                  type="button"
                  variant={isSavedViewDirty ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={isPending}
                  onClick={handleSave}
                >
                  <Save className="mr-1 h-3.5 w-3.5" />
                  Save
                </Button>
                {activeSavedViewId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    disabled={isPending}
                    onClick={openSaveAsSheet}
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" />
                    Save as
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <SaveViewSheet
        open={saveOpen}
        onOpenChange={setSaveOpen}
        defaultName={saveDefaultName}
        onSaved={() => omnibar.notifySavedViewsChanged()}
      />
    </>
  );
}
