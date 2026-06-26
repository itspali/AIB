"use client";

import { ArrowUpDown, Sparkles } from "lucide-react";
import { UomListColumnSettings } from "@/components/inventory/uom/uom-list-column-settings";
import { CatalogToolbarTrailingControls } from "@/components/layout/catalog-toolbar-trailing-controls";
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
import {
  listToolbarSelectClass,
  listToolbarSortTriggerClass,
  listToolbarViewToggleShellClass,
} from "@/lib/layout/list-toolbar-chrome";
import type { UomListPrefs, UomActiveStatusFilter, UomFamilyFilter } from "@/lib/uom/list-prefs";
import {
  UOM_SORT_OPTIONS,
  uomSortOptionKey,
  type UomListSortDirection,
} from "@/lib/uom/list-sort";
import { UOM_FAMILIES, uomFamilyLabel } from "@/lib/uom/types";
import { cn } from "@/lib/utils";

type Props = {
  prefs: UomListPrefs;
  onPrefsChange: (prefs: UomListPrefs) => void;
  resultCount: number;
  totalCount: number;
  prefsHydrated?: boolean;
  canManage?: boolean;
  isLoadingDefaults?: boolean;
  onLoadDefaults?: () => void;
};

const STATUS_LABELS: Record<UomActiveStatusFilter, string> = {
  all: "All statuses",
  active: "Active",
  inactive: "Inactive",
};

export function UomListToolbar({
  prefs,
  onPrefsChange,
  resultCount,
  totalCount,
  prefsHydrated = true,
  canManage = false,
  isLoadingDefaults = false,
  onLoadDefaults,
}: Props) {
  const { deviceClass } = useDeviceClass();
  const controlsDisabled = !prefsHydrated;
  const statusActive = prefs.activeStatusFilter !== "all";
  const familyActive = prefs.familyFilter !== "all";
  const extraFilterCount = (statusActive ? 1 : 0) + (familyActive ? 1 : 0);

  const sortValue = uomSortOptionKey(prefs.sortField, prefs.sortDirection);
  const activeSortLabel =
    UOM_SORT_OPTIONS.find(
      (option) => uomSortOptionKey(option.field, option.direction) === sortValue
    )?.label ?? "Sort";

  const clearExtras = () =>
    onPrefsChange({
      ...prefs,
      activeStatusFilter: "all",
      familyFilter: "all",
    });

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun="unit"
      countNounPlural="units"
      hideCount
      controls={
        <>
          <ModuleListToolbarFilters
            extras={{
              extraFilterCount,
              onClearExtras: clearExtras,
              extraDropdownContent: (
                <div className="space-y-3 p-1">
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">Status</p>
                    <Select
                      value={prefs.activeStatusFilter}
                      disabled={controlsDisabled}
                      onValueChange={(value) =>
                        onPrefsChange({
                          ...prefs,
                          activeStatusFilter: value as UomActiveStatusFilter,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABELS) as UomActiveStatusFilter[]).map((key) => (
                          <SelectItem key={key} value={key}>
                            {STATUS_LABELS[key]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">Family</p>
                    <Select
                      value={prefs.familyFilter}
                      disabled={controlsDisabled}
                      onValueChange={(value) =>
                        onPrefsChange({
                          ...prefs,
                          familyFilter: value as UomFamilyFilter,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All families</SelectItem>
                        {UOM_FAMILIES.map((family) => (
                          <SelectItem key={family} value={family}>
                            {uomFamilyLabel(family)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ),
            }}
          />

          <Select
            value={prefs.activeStatusFilter}
            disabled={controlsDisabled}
            onValueChange={(value) =>
              onPrefsChange({
                ...prefs,
                activeStatusFilter: value as UomActiveStatusFilter,
              })
            }
          >
            <SelectTrigger
              className={cn(listToolbarSelectClass(statusActive), "hidden md:inline-flex")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as UomActiveStatusFilter[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {STATUS_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={prefs.familyFilter}
            disabled={controlsDisabled}
            onValueChange={(value) =>
              onPrefsChange({
                ...prefs,
                familyFilter: value as UomFamilyFilter,
              })
            }
          >
            <SelectTrigger
              className={cn(listToolbarSelectClass(familyActive), "hidden md:inline-flex")}
            >
              <SelectValue placeholder="All families" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All families</SelectItem>
              {UOM_FAMILIES.map((family) => (
                <SelectItem key={family} value={family}>
                  {uomFamilyLabel(family)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className={cn(listToolbarViewToggleShellClass(), "inline-flex")}>
            <Select
              value={sortValue}
              disabled={controlsDisabled}
              onValueChange={(value) => {
                const option = UOM_SORT_OPTIONS.find(
                  (entry) => uomSortOptionKey(entry.field, entry.direction) === value
                );
                if (!option) return;
                onPrefsChange({
                  ...prefs,
                  sortField: option.field,
                  sortDirection: option.direction as UomListSortDirection,
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
                {UOM_SORT_OPTIONS.map((option) => (
                  <SelectItem
                    key={uomSortOptionKey(option.field, option.direction)}
                    value={uomSortOptionKey(option.field, option.direction)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CatalogToolbarTrailingControls
            columnSettings={
              <UomListColumnSettings
                prefs={prefs}
                onChange={onPrefsChange}
                detectedDeviceClass={deviceClass}
                disabled={controlsDisabled}
              />
            }
          />

          {canManage && onLoadDefaults ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="hidden h-7 gap-1.5 px-2.5 text-xs lg:inline-flex"
              disabled={isLoadingDefaults}
              onClick={onLoadDefaults}
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Load defaults
            </Button>
          ) : null}
        </>
      }
    />
  );
}
