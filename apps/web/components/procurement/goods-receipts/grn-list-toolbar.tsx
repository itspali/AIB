"use client";

import { ArrowUpDown } from "lucide-react";
import { CatalogToolbarTrailingControls } from "@/components/layout/catalog-toolbar-trailing-controls";
import { ListModuleToolbarRow } from "@/components/layout/list-module-toolbar-row";
import { GrnListColumnSettings } from "@/components/procurement/goods-receipts/grn-list-column-settings";
import { ModuleListToolbarFilters } from "@/components/search/module-list-toolbar-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeviceClass } from "@/hooks/use-device-class";
import type { GoodsReceiptListPrefs } from "@/lib/procurement/goods-receipts/list-prefs";
import {
  GRN_LIST_SORT_OPTIONS,
  goodsReceiptSortOptionKey,
  type GoodsReceiptListSortDirection,
} from "@/lib/procurement/goods-receipts/list-sort";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";
import {
  listToolbarSelectClass,
  listToolbarSortTriggerClass,
  listToolbarViewToggleShellClass,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

type Props = {
  prefs: GoodsReceiptListPrefs;
  onPrefsChange: (prefs: GoodsReceiptListPrefs) => void;
  locations: ProcurementLocationOption[];
  resultCount: number;
  totalCount: number;
  compactCountLabel?: boolean;
  prefsHydrated?: boolean;
  hideCount?: boolean;
};

export function GrnListToolbar({
  prefs,
  onPrefsChange,
  locations,
  resultCount,
  totalCount,
  compactCountLabel = false,
  prefsHydrated = true,
  hideCount = false,
}: Props) {
  const { deviceClass } = useDeviceClass();
  const controlsDisabled = !prefsHydrated;
  const locationActive = Boolean(prefs.locationId);
  const sortValue = goodsReceiptSortOptionKey(prefs.sortField, prefs.sortDirection);
  const activeSortLabel =
    GRN_LIST_SORT_OPTIONS.find(
      (option) => goodsReceiptSortOptionKey(option.field, option.direction) === sortValue
    )?.label ?? "Sort";

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun="receipt"
      countNounPlural="receipts"
      compactCountLabel={compactCountLabel}
      hideCount={hideCount}
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
              className={cn(
                listToolbarSelectClass(locationActive),
                "hidden min-w-[8rem] md:inline-flex"
              )}
            >
              <SelectValue placeholder="All locations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location.id} value={location.id}>
                  {location.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className={cn(listToolbarViewToggleShellClass(), "inline-flex")}>
            <Select
              value={sortValue}
              disabled={controlsDisabled}
              onValueChange={(value) => {
                const option = GRN_LIST_SORT_OPTIONS.find(
                  (entry) => goodsReceiptSortOptionKey(entry.field, entry.direction) === value
                );
                if (!option) return;
                onPrefsChange({
                  ...prefs,
                  sortField: option.field,
                  sortDirection: option.direction as GoodsReceiptListSortDirection,
                });
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
                {GRN_LIST_SORT_OPTIONS.map((option) => (
                  <SelectItem
                    key={goodsReceiptSortOptionKey(option.field, option.direction)}
                    value={goodsReceiptSortOptionKey(option.field, option.direction)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CatalogToolbarTrailingControls
            columnSettings={
              <GrnListColumnSettings
                prefs={prefs}
                onChange={onPrefsChange}
                detectedDeviceClass={deviceClass}
                disabled={controlsDisabled}
              />
            }
          />
        </>
      }
    />
  );
}
