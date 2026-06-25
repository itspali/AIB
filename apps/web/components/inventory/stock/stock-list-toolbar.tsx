"use client";

import { ArrowUpDown } from "lucide-react";
import { StockListColumnSettings } from "@/components/inventory/stock/stock-list-column-settings";
import { CatalogToolbarTrailingControls } from "@/components/layout/catalog-toolbar-trailing-controls";
import { ListModuleToolbarRow } from "@/components/layout/list-module-toolbar-row";
import { ModuleListToolbarFilters } from "@/components/search/module-list-toolbar-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeviceClass } from "@/hooks/use-device-class";
import { stockListViewModeLabel } from "@/lib/inventory/stock/labels";
import type { StockListPrefs } from "@/lib/inventory/stock/list-prefs";
import {
  getStockSortPrefs,
  setStockSortPrefs,
} from "@/lib/inventory/stock/list-prefs";
import {
  STOCK_ADJUSTMENT_SORT_OPTIONS,
  STOCK_BALANCE_SORT_OPTIONS,
  stockSortOptionKey,
  type StockListSortDirection,
} from "@/lib/inventory/stock/list-sort";
import {
  isStockListTableView,
  STOCK_LIST_VIEW_MODES,
  type StockListViewMode,
  type StockLocationOption,
} from "@/lib/inventory/stock/types";
import {
  listToolbarSelectClass,
  listToolbarSortTriggerClass,
  listToolbarViewToggleShellClass,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

type Props = {
  prefs: StockListPrefs;
  onPrefsChange: (prefs: StockListPrefs) => void;
  locations: StockLocationOption[];
  resultCount: number;
  totalCount: number;
  compactCountLabel?: boolean;
  hideCount?: boolean;
  prefsHydrated?: boolean;
};

function countLabels(prefs: StockListPrefs) {
  switch (prefs.viewMode) {
    case "adjustments":
      return { countNoun: "adjustment", countNounPlural: "adjustments" };
    case "inventory_pools":
      return { countNoun: "pool row", countNounPlural: "pool rows" };
    case "promo_reclassification":
      return { countNoun: "promo item", countNounPlural: "promo items" };
    default:
      return { countNoun: "balance", countNounPlural: "balances" };
  }
}

function StockViewModeSelect({
  value,
  disabled,
  onValueChange,
  triggerClassName,
}: {
  value: StockListViewMode;
  disabled?: boolean;
  onValueChange: (viewMode: StockListViewMode) => void;
  triggerClassName?: string;
}) {
  const viewActive = value !== "balances";

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next as StockListViewMode)}
    >
      <SelectTrigger
        className={cn(listToolbarSelectClass(viewActive), triggerClassName)}
        aria-label={`View: ${stockListViewModeLabel(value)}`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {STOCK_LIST_VIEW_MODES.map((mode) => (
          <SelectItem key={mode} value={mode}>
            {stockListViewModeLabel(mode)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function StockListToolbar({
  prefs,
  onPrefsChange,
  locations,
  resultCount,
  totalCount,
  compactCountLabel = false,
  hideCount = false,
  prefsHydrated = true,
}: Props) {
  const { deviceClass } = useDeviceClass();
  const controlsDisabled = !prefsHydrated;
  const locationActive = Boolean(prefs.locationId);
  const viewActive = prefs.viewMode !== "balances";
  const showListTableControls = isStockListTableView(prefs.viewMode);
  const { countNoun, countNounPlural } = countLabels(prefs);

  const setViewMode = (viewMode: StockListViewMode) => {
    if (prefs.viewMode === viewMode) return;
    onPrefsChange({ ...prefs, viewMode });
  };

  const sortOptions =
    prefs.viewMode === "adjustments"
      ? STOCK_ADJUSTMENT_SORT_OPTIONS
      : STOCK_BALANCE_SORT_OPTIONS;
  const { field: sortField, direction: sortDirection } = getStockSortPrefs(prefs);
  const sortValue = stockSortOptionKey(sortField, sortDirection);
  const activeSortLabel =
    sortOptions.find((option) => stockSortOptionKey(option.field, option.direction) === sortValue)
      ?.label ?? "Sort";

  const extraFilterCount = (locationActive ? 1 : 0) + (viewActive ? 1 : 0);

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun={countNoun}
      countNounPlural={countNounPlural}
      compactCountLabel={compactCountLabel}
      hideCount={hideCount}
      controls={
        <>
          <ModuleListToolbarFilters
            extras={{
              extraFilterCount,
              onClearExtras: () =>
                onPrefsChange({ ...prefs, locationId: null, viewMode: "balances" }),
              extraDropdownContent: (
                <div className="space-y-3 p-1">
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">View</p>
                    <StockViewModeSelect
                      value={prefs.viewMode}
                      disabled={controlsDisabled}
                      onValueChange={setViewMode}
                      triggerClassName="h-8 w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">Location</p>
                    <Select
                      value={prefs.locationId ?? "all"}
                      disabled={controlsDisabled}
                      onValueChange={(value) =>
                        onPrefsChange({
                          ...prefs,
                          locationId: value === "all" ? null : value,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue placeholder="All locations" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All locations</SelectItem>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                            {location.code ? ` (${location.code})` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ),
            }}
          />

          <StockViewModeSelect
            value={prefs.viewMode}
            disabled={controlsDisabled}
            onValueChange={setViewMode}
            triggerClassName="min-w-[8.5rem] max-w-[11rem] [&>span]:truncate"
          />

          <Select
            value={prefs.locationId ?? "all"}
            disabled={controlsDisabled}
            onValueChange={(value) =>
              onPrefsChange({
                ...prefs,
                locationId: value === "all" ? null : value,
              })
            }
          >
            <SelectTrigger
              className={cn(listToolbarSelectClass(locationActive), "hidden md:inline-flex")}
            >
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                  {location.code ? ` (${location.code})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {showListTableControls ? (
            <>
              <div className={cn(listToolbarViewToggleShellClass(), "inline-flex")}>
                <Select
                  value={sortValue}
                  disabled={controlsDisabled}
                  onValueChange={(value) => {
                    const option = sortOptions.find(
                      (entry) => stockSortOptionKey(entry.field, entry.direction) === value
                    );
                    if (!option) return;
                    onPrefsChange(
                      setStockSortPrefs(
                        prefs,
                        option.field,
                        option.direction as StockListSortDirection
                      )
                    );
                  }}
                >
                  <SelectTrigger
                    className={listToolbarSortTriggerClass(true)}
                    title={`Sort: ${activeSortLabel}`}
                    aria-label={`Sort: ${activeSortLabel}`}
                  >
                    <SelectValue />
                    <ArrowUpDown className="h-4 w-4 shrink-0" aria-hidden />
                  </SelectTrigger>
                  <SelectContent align="end">
                    {sortOptions.map((option) => (
                      <SelectItem
                        key={stockSortOptionKey(option.field, option.direction)}
                        value={stockSortOptionKey(option.field, option.direction)}
                      >
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <CatalogToolbarTrailingControls
                columnSettings={
                  <StockListColumnSettings
                    prefs={prefs}
                    onChange={onPrefsChange}
                    detectedDeviceClass={deviceClass}
                    disabled={controlsDisabled}
                  />
                }
              />
            </>
          ) : null}
        </>
      }
    />
  );
}
