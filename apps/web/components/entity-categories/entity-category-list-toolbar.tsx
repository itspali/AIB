"use client";

import { ArrowUpDown, ListTree, Rows3, Table2 } from "lucide-react";
import { EntityCategoryListColumnSettings } from "@/components/entity-categories/entity-category-list-column-settings";
import { ListModuleToolbarRow } from "@/components/layout/list-module-toolbar-row";
import { ModuleListToolbarFilters } from "@/components/search/module-list-toolbar-filters";
import { ModuleViewSelect } from "@/components/search/module-view-select";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_ENTITY_CATEGORY_LIST_SORT_DIRECTION,
  DEFAULT_ENTITY_CATEGORY_LIST_SORT_FIELD,
  getEntityCategoryListSortOptions,
  sortOptionKey,
} from "@/lib/entity-categories/list-sort";
import type {
  EntityCategoryListPrefs,
  EntityCategoryListViewMode,
  DeviceClass,
} from "@/lib/entity-categories/list-prefs";
import { isEntityCategoryTableLikeViewMode } from "@/lib/entity-categories/list-prefs";
import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";
import {
  LIST_TOOLBAR_MODULE_VIEW_WIDTH,
  listToolbarModuleViewTriggerClass,
  listToolbarSelectClass,
  listToolbarSortTriggerClass,
  listToolbarViewToggleSegmentClass,
  listToolbarViewToggleShellClass,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

type Props = {
  workspace: EntityCategoryWorkspace;
  prefs: EntityCategoryListPrefs;
  onPrefsChange: (prefs: EntityCategoryListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  resultCount: number;
  totalCount: number;
  compactCountLabel?: boolean;
  prefsHydrated?: boolean;
};

export function EntityCategoryListToolbar({
  workspace,
  prefs,
  onPrefsChange,
  detectedDeviceClass,
  resultCount,
  totalCount,
  compactCountLabel = false,
  prefsHydrated = true,
}: Props) {
  const omnibar = useOptionalOmnibarContext();
  const isViewFilterActive = omnibar?.hasActiveFilters ?? false;
  const controlsDisabled = !prefsHydrated;
  const isTableLike = isEntityCategoryTableLikeViewMode(prefs.viewMode);
  const sortOptions = getEntityCategoryListSortOptions(workspace);

  const setViewMode = (viewMode: EntityCategoryListViewMode) => {
    if (controlsDisabled || prefs.viewMode === viewMode) return;
    onPrefsChange({ ...prefs, viewMode });
  };

  const sortValue = sortOptionKey(prefs.sortField, prefs.sortDirection);
  const activeSortLabel =
    sortOptions.find(
      (option) => sortOptionKey(option.field, option.direction) === sortValue
    )?.label ?? "Sort";
  const isSortActive =
    prefs.sortField !== DEFAULT_ENTITY_CATEGORY_LIST_SORT_FIELD ||
    prefs.sortDirection !== DEFAULT_ENTITY_CATEGORY_LIST_SORT_DIRECTION;

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun="category"
      countNounPlural="categories"
      compactCountLabel={compactCountLabel}
      controls={
        <>
          <ModuleListToolbarFilters />
          <ModuleViewSelect
            borderless
            menuAlign="end"
            className="min-w-0 shrink-0"
            triggerActive={isViewFilterActive}
            triggerClassName={cn(
              listToolbarModuleViewTriggerClass(isViewFilterActive),
              LIST_TOOLBAR_MODULE_VIEW_WIDTH
            )}
          />

          {isTableLike ? (
            <div className={cn(listToolbarViewToggleShellClass(), "hidden sm:inline-flex")}>
              <Select
                value={sortValue}
                disabled={controlsDisabled}
                onValueChange={(value) => {
                  const option = sortOptions.find(
                    (entry) => sortOptionKey(entry.field, entry.direction) === value
                  );
                  if (!option) return;
                  onPrefsChange({
                    ...prefs,
                    sortField: option.field,
                    sortDirection: option.direction,
                  });
                }}
              >
                <SelectTrigger
                  className={listToolbarSortTriggerClass(isSortActive)}
                  title={`Sort: ${activeSortLabel}`}
                  aria-label={`Sort categories: ${activeSortLabel}`}
                >
                  <SelectValue />
                  <ArrowUpDown className="h-4 w-4 shrink-0" aria-hidden />
                </SelectTrigger>
                <SelectContent align="end">
                  {sortOptions.map((option) => (
                    <SelectItem
                      key={sortOptionKey(option.field, option.direction)}
                      value={sortOptionKey(option.field, option.direction)}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}

          <div className="shrink-0 sm:hidden">
            <Select
              value={prefs.viewMode}
              disabled={controlsDisabled}
              onValueChange={(value) => setViewMode(value as EntityCategoryListViewMode)}
            >
              <SelectTrigger
                className={cn(listToolbarSelectClass(true), "w-auto px-1.5 [&>svg]:hidden")}
                aria-label="View mode"
                title="View mode"
              >
                <span className="flex items-center">
                  {prefs.viewMode === "tree" ? (
                    <ListTree className="h-4 w-4" aria-hidden />
                  ) : prefs.viewMode === "compact" ? (
                    <Rows3 className="h-4 w-4" aria-hidden />
                  ) : (
                    <Table2 className="h-4 w-4" aria-hidden />
                  )}
                </span>
              </SelectTrigger>
              <SelectContent align="end">
                <SelectItem value="tree">
                  <span className="flex items-center gap-2">
                    <ListTree className="h-4 w-4" aria-hidden />
                    Tree
                  </span>
                </SelectItem>
                <SelectItem value="table">
                  <span className="flex items-center gap-2">
                    <Table2 className="h-4 w-4" aria-hidden />
                    Table
                  </span>
                </SelectItem>
                <SelectItem value="compact">
                  <span className="flex items-center gap-2">
                    <Rows3 className="h-4 w-4" aria-hidden />
                    Compact
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div
            className={cn(listToolbarViewToggleShellClass(), "hidden sm:inline-flex")}
            aria-label="View mode"
          >
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={listToolbarViewToggleSegmentClass(prefs.viewMode === "tree")}
              disabled={controlsDisabled}
              onClick={() => setViewMode("tree")}
              title="Tree view"
              aria-label="Tree view"
              aria-pressed={prefs.viewMode === "tree"}
            >
              <ListTree className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={listToolbarViewToggleSegmentClass(prefs.viewMode === "table")}
              disabled={controlsDisabled}
              onClick={() => setViewMode("table")}
              title="Table view"
              aria-label="Table view"
              aria-pressed={prefs.viewMode === "table"}
            >
              <Table2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className={listToolbarViewToggleSegmentClass(prefs.viewMode === "compact")}
              disabled={controlsDisabled}
              onClick={() => setViewMode("compact")}
              title="Compact table"
              aria-label="Compact table"
              aria-pressed={prefs.viewMode === "compact"}
            >
              <Rows3 className="h-4 w-4" />
            </Button>
          </div>

          {isTableLike ? (
            <EntityCategoryListColumnSettings
              workspace={workspace}
              prefs={prefs}
              onChange={onPrefsChange}
              detectedDeviceClass={detectedDeviceClass}
              disabled={controlsDisabled}
            />
          ) : null}
        </>
      }
    />
  );
}
