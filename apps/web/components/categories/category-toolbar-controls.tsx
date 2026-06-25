"use client";

import { ArrowUpDown, ListTree, Table2 } from "lucide-react";
import { CategoryListColumnSettings } from "@/components/categories/category-list-column-settings";
import { ModuleListToolbarFilters } from "@/components/search/module-list-toolbar-filters";
import { ModuleViewSelect } from "@/components/search/module-view-select";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryListPrefs, CategoryListViewMode } from "@/lib/categories/list-prefs";
import { isCategoryTableLikeViewMode } from "@/lib/categories/list-prefs";
import {
  CATEGORY_LIST_SORT_OPTIONS,
  DEFAULT_CATEGORY_LIST_SORT_DIRECTION,
  DEFAULT_CATEGORY_LIST_SORT_FIELD,
  sortOptionKey,
} from "@/lib/categories/list-sort";
import type { DeviceClass } from "@/lib/layout/device-class";
import type { ListWorkspaceLayout } from "@/lib/layout/list-workspace";
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
  prefs: CategoryListPrefs;
  onPrefsChange: (prefs: CategoryListPrefs) => void;
  detectedDeviceClass: DeviceClass;
  prefsHydrated?: boolean;
  workspaceLayout?: ListWorkspaceLayout;
};

export function CategoryToolbarControls({
  prefs,
  onPrefsChange,
  detectedDeviceClass,
  prefsHydrated = true,
  workspaceLayout,
}: Props) {
  const omnibar = useOptionalOmnibarContext();
  const isViewFilterActive = omnibar?.hasActiveFilters ?? false;
  const controlsDisabled = !prefsHydrated;
  const isTableLike = isCategoryTableLikeViewMode(prefs.viewMode);

  const setViewMode = (viewMode: CategoryListViewMode) => {
    if (controlsDisabled || prefs.viewMode === viewMode) return;
    onPrefsChange({ ...prefs, viewMode });
  };

  const sortValue = sortOptionKey(prefs.sortField, prefs.sortDirection);
  const activeSortLabel =
    CATEGORY_LIST_SORT_OPTIONS.find(
      (option) => sortOptionKey(option.field, option.direction) === sortValue
    )?.label ?? "Sort";
  const isSortActive =
    prefs.sortField !== DEFAULT_CATEGORY_LIST_SORT_FIELD ||
    prefs.sortDirection !== DEFAULT_CATEGORY_LIST_SORT_DIRECTION;

  return (
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
              const option = CATEGORY_LIST_SORT_OPTIONS.find(
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
              {CATEGORY_LIST_SORT_OPTIONS.map((option) => (
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
          onValueChange={(value) => setViewMode(value as CategoryListViewMode)}
        >
          <SelectTrigger
            className={cn(listToolbarSelectClass(true), "w-auto px-1.5 [&>svg]:hidden")}
            aria-label="View mode"
            title="View mode"
          >
            <span className="flex items-center">
              {prefs.viewMode === "tree" ? (
                <ListTree className="h-4 w-4" aria-hidden />
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
          </SelectContent>
        </Select>
      </div>

      <div
        className={cn(listToolbarViewToggleShellClass(), "hidden sm:inline-flex")}
        aria-label="Category view mode"
      >
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={listToolbarViewToggleSegmentClass(prefs.viewMode === "tree")}
          disabled={controlsDisabled}
          onClick={() => setViewMode("tree")}
          title="Tree view — hierarchy with inline detail"
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
          title="Table view — registry matrix"
          aria-label="Table view"
          aria-pressed={prefs.viewMode === "table"}
        >
          <Table2 className="h-4 w-4" />
        </Button>
      </div>

      <CategoryListColumnSettings
        prefs={prefs}
        onChange={onPrefsChange}
        detectedDeviceClass={detectedDeviceClass}
        disabled={controlsDisabled}
        workspaceLayout={workspaceLayout}
      />
    </>
  );
}

export function CategoryToolbarCount({
  resultCount,
  totalCount,
}: {
  resultCount: number;
  totalCount: number;
}) {
  return (
    <>
      {resultCount}/{totalCount}
    </>
  );
}
