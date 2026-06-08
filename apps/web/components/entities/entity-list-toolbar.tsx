"use client";

import { ArrowUpDown, Rows3, Settings2, Table2 } from "lucide-react";
import { ListModuleToolbarRow } from "@/components/layout/list-module-toolbar-row";
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
import type { DeviceClass } from "@/lib/layout/device-class";
import {
  LIST_TOOLBAR_MODULE_VIEW_WIDTH,
  listToolbarModuleViewTriggerClass,
  listToolbarSelectClass,
  listToolbarSortTriggerClass,
  listToolbarViewToggleSegmentClass,
  listToolbarViewToggleShellClass,
} from "@/lib/layout/list-toolbar-chrome";
import type { EntityListColumnRegistryKey } from "@/lib/entities/list-columns";
import type { EntityListPrefs, EntityListViewMode } from "@/lib/entities/list-prefs";
import { isEntityTableLikeViewMode } from "@/lib/entities/list-prefs";
import {
  DEFAULT_ENTITY_LIST_SORT_DIRECTION,
  DEFAULT_ENTITY_LIST_SORT_FIELD,
  ENTITY_LIST_SORT_OPTIONS,
  sortOptionKey,
} from "@/lib/entities/list-sort";
import { getEntityWorkspaceConfig } from "@/lib/entities/workspace-config";
import type { EntityWorkspace } from "@/lib/entities/types";
import { cn } from "@/lib/utils";

export type EntityActiveStatusFilter = "all" | "active" | "inactive";

type Props = {
  workspace: EntityWorkspace;
  registryKey: EntityListColumnRegistryKey;
  prefs: EntityListPrefs;
  onPrefsChange: (prefs: EntityListPrefs) => void;
  activeStatusFilter: EntityActiveStatusFilter;
  onActiveStatusFilterChange: (filter: EntityActiveStatusFilter) => void;
  detectedDeviceClass: DeviceClass;
  resultCount: number;
  totalCount: number;
  compactCountLabel?: boolean;
  prefsHydrated?: boolean;
};

export function EntityListToolbar({
  workspace,
  prefs,
  onPrefsChange,
  activeStatusFilter,
  onActiveStatusFilterChange,
  resultCount,
  totalCount,
  compactCountLabel = false,
  prefsHydrated = true,
}: Props) {
  const config = getEntityWorkspaceConfig(workspace);
  const omnibar = useOptionalOmnibarContext();
  const isViewFilterActive = omnibar?.hasActiveFilters ?? false;
  const controlsDisabled = !prefsHydrated;
  const isTableLike = isEntityTableLikeViewMode(prefs.viewMode);
  const statusFilterActive = activeStatusFilter !== "all";
  const countNoun = config.singularLabel.toLowerCase();
  const countNounPlural = `${countNoun}s`;

  const setViewMode = (viewMode: EntityListViewMode) => {
    if (controlsDisabled || prefs.viewMode === viewMode) return;
    onPrefsChange({ ...prefs, viewMode });
  };

  const sortValue = sortOptionKey(prefs.sortField, prefs.sortDirection);
  const activeSortLabel =
    ENTITY_LIST_SORT_OPTIONS.find(
      (option) => sortOptionKey(option.field, option.direction) === sortValue
    )?.label ?? "Sort";
  const isSortActive =
    prefs.sortField !== DEFAULT_ENTITY_LIST_SORT_FIELD ||
    prefs.sortDirection !== DEFAULT_ENTITY_LIST_SORT_DIRECTION;

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun={countNoun}
      countNounPlural={countNounPlural}
      compactCountLabel={compactCountLabel}
      controls={
        <>
          <ModuleListToolbarFilters
            extras={{
              extraFilterCount: statusFilterActive ? 1 : 0,
              onClearExtras: () => onActiveStatusFilterChange("all"),
              extraDropdownContent: (
                <div className="space-y-2 p-1">
                  <p className="px-2 text-xs font-medium text-muted-foreground">Status</p>
                  <Select
                    value={activeStatusFilter}
                    disabled={controlsDisabled}
                    onValueChange={(value) =>
                      onActiveStatusFilterChange(value as EntityActiveStatusFilter)
                    }
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="active">Active only</SelectItem>
                      <SelectItem value="inactive">Inactive only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ),
            }}
          />

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
                  const option = ENTITY_LIST_SORT_OPTIONS.find(
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
                  aria-label={`Sort ${countNounPlural}: ${activeSortLabel}`}
                >
                  <SelectValue />
                  <ArrowUpDown className="h-4 w-4 shrink-0" aria-hidden />
                </SelectTrigger>
                <SelectContent align="end">
                  {ENTITY_LIST_SORT_OPTIONS.map((option) => (
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
              onValueChange={(value) => setViewMode(value as EntityListViewMode)}
            >
              <SelectTrigger
                className={cn(listToolbarSelectClass(true), "w-auto px-1.5 [&>svg]:hidden")}
                aria-label="View mode"
                title="View mode"
              >
                <span className="flex items-center">
                  {prefs.viewMode === "compact" ? (
                    <Rows3 className="h-4 w-4" aria-hidden />
                  ) : (
                    <Table2 className="h-4 w-4" aria-hidden />
                  )}
                </span>
              </SelectTrigger>
              <SelectContent align="end">
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
              title="Compact view"
              aria-label="Compact view"
              aria-pressed={prefs.viewMode === "compact"}
            >
              <Rows3 className="h-4 w-4" />
            </Button>
          </div>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="hidden h-8 w-8 shrink-0 p-0 sm:inline-flex"
            disabled={controlsDisabled}
            title="Column settings (coming soon)"
            aria-label="Column settings"
          >
            <Settings2 className="h-4 w-4" aria-hidden />
          </Button>
        </>
      }
    />
  );
}
