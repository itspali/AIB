"use client";

import { ArrowUpDown, ClipboardList, Table2 } from "lucide-react";
import { StockListColumnSettings } from "@/components/inventory/stock/stock-list-column-settings";
import { ListModuleToolbarRow } from "@/components/layout/list-module-toolbar-row";
import { ModuleListToolbarFilters } from "@/components/search/module-list-toolbar-filters";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeviceClass } from "@/hooks/use-device-class";
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
import type { StockListViewMode, StockLocationOption } from "@/lib/inventory/stock/types";
import {
  listToolbarSelectClass,
  listToolbarSortTriggerClass,
  listToolbarViewToggleSegmentClass,
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
  prefsHydrated?: boolean;
};

export function StockListToolbar({
  prefs,
  onPrefsChange,
  locations,
  resultCount,
  totalCount,
  compactCountLabel = false,
  prefsHydrated = true,
}: Props) {
  const { deviceClass } = useDeviceClass();
  const controlsDisabled = !prefsHydrated;
  const locationActive = Boolean(prefs.locationId);

  const setViewMode = (viewMode: StockListViewMode) => {
    if (controlsDisabled || prefs.viewMode === viewMode) return;
    onPrefsChange({ ...prefs, viewMode });
  };

  const countNoun = prefs.viewMode === "balances" ? "balance" : "adjustment";
  const countNounPlural = prefs.viewMode === "balances" ? "balances" : "adjustments";

  const sortOptions =
    prefs.viewMode === "balances" ? STOCK_BALANCE_SORT_OPTIONS : STOCK_ADJUSTMENT_SORT_OPTIONS;
  const { field: sortField, direction: sortDirection } = getStockSortPrefs(prefs);
  const sortValue = stockSortOptionKey(sortField, sortDirection);
  const activeSortLabel =
    sortOptions.find((option) => stockSortOptionKey(option.field, option.direction) === sortValue)
      ?.label ?? "Sort";

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
              extraFilterCount: locationActive ? 1 : 0,
              onClearExtras: () => onPrefsChange({ ...prefs, locationId: null }),
              extraDropdownContent: (
                <div className="space-y-2 p-1">
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
              ),
            }}
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

          <div className={cn(listToolbarViewToggleShellClass(), "inline-flex")}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={controlsDisabled}
              className={listToolbarViewToggleSegmentClass(prefs.viewMode === "balances")}
              onClick={() => setViewMode("balances")}
              aria-label="Balances view"
              title="Balances"
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={controlsDisabled}
              className={listToolbarViewToggleSegmentClass(prefs.viewMode === "adjustments")}
              onClick={() => setViewMode("adjustments")}
              aria-label="Adjustments view"
              title="Adjustments"
            >
              <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>

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
                  setStockSortPrefs(prefs, option.field, option.direction as StockListSortDirection)
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

          <StockListColumnSettings
            prefs={prefs}
            onChange={onPrefsChange}
            detectedDeviceClass={deviceClass}
            disabled={controlsDisabled}
          />
        </>
      }
    />
  );
}
