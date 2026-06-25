"use client";

import { ArrowUpDown, Sparkles } from "lucide-react";
import { TaxListColumnSettings } from "@/components/settings/tax/tax-list-column-settings";
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
import type { TaxListPrefs, TaxActiveStatusFilter, TaxKindFilter } from "@/lib/tax/list-prefs";
import {
  TAX_SORT_OPTIONS,
  taxSortOptionKey,
  type TaxListSortDirection,
} from "@/lib/tax/list-sort";
import { TAX_CODE_KINDS, taxCodeKindLabel } from "@/lib/tax/types";
import { cn } from "@/lib/utils";

type Props = {
  prefs: TaxListPrefs;
  onPrefsChange: (prefs: TaxListPrefs) => void;
  resultCount: number;
  totalCount: number;
  compactCountLabel?: boolean;
  prefsHydrated?: boolean;
  canEdit?: boolean;
  isLoadingDefaults?: boolean;
  onLoadDefaults?: () => void;
};

const STATUS_LABELS: Record<TaxActiveStatusFilter, string> = {
  all: "All statuses",
  active: "Active",
  inactive: "Inactive",
};

export function TaxListToolbar({
  prefs,
  onPrefsChange,
  resultCount,
  totalCount,
  compactCountLabel = false,
  prefsHydrated = true,
  canEdit = false,
  isLoadingDefaults = false,
  onLoadDefaults,
}: Props) {
  const { deviceClass } = useDeviceClass();
  const controlsDisabled = !prefsHydrated;
  const statusActive = prefs.activeStatusFilter !== "all";
  const kindActive = prefs.kindFilter !== "all";
  const extraFilterCount = (statusActive ? 1 : 0) + (kindActive ? 1 : 0);

  const sortValue = taxSortOptionKey(prefs.sortField, prefs.sortDirection);
  const activeSortLabel =
    TAX_SORT_OPTIONS.find(
      (option) => taxSortOptionKey(option.field, option.direction) === sortValue
    )?.label ?? "Sort";

  const clearExtras = () =>
    onPrefsChange({
      ...prefs,
      activeStatusFilter: "all",
      kindFilter: "all",
    });

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun="tax rule"
      countNounPlural="tax rules"
      compactCountLabel={compactCountLabel}
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
                          activeStatusFilter: value as TaxActiveStatusFilter,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABELS) as TaxActiveStatusFilter[]).map((key) => (
                          <SelectItem key={key} value={key}>
                            {STATUS_LABELS[key]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">Kind</p>
                    <Select
                      value={prefs.kindFilter}
                      disabled={controlsDisabled}
                      onValueChange={(value) =>
                        onPrefsChange({
                          ...prefs,
                          kindFilter: value as TaxKindFilter,
                        })
                      }
                    >
                      <SelectTrigger className="h-8 w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All kinds</SelectItem>
                        {TAX_CODE_KINDS.map((kind) => (
                          <SelectItem key={kind} value={kind}>
                            {taxCodeKindLabel(kind)}
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
                activeStatusFilter: value as TaxActiveStatusFilter,
              })
            }
          >
            <SelectTrigger
              className={cn(listToolbarSelectClass(statusActive), "hidden md:inline-flex")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(STATUS_LABELS) as TaxActiveStatusFilter[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {STATUS_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={prefs.kindFilter}
            disabled={controlsDisabled}
            onValueChange={(value) =>
              onPrefsChange({
                ...prefs,
                kindFilter: value as TaxKindFilter,
              })
            }
          >
            <SelectTrigger
              className={cn(listToolbarSelectClass(kindActive), "hidden md:inline-flex")}
            >
              <SelectValue placeholder="All kinds" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All kinds</SelectItem>
              {TAX_CODE_KINDS.map((kind) => (
                <SelectItem key={kind} value={kind}>
                  {taxCodeKindLabel(kind)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className={cn(listToolbarViewToggleShellClass(), "inline-flex")}>
            <Select
              value={sortValue}
              disabled={controlsDisabled}
              onValueChange={(value) => {
                const option = TAX_SORT_OPTIONS.find(
                  (entry) => taxSortOptionKey(entry.field, entry.direction) === value
                );
                if (!option) return;
                onPrefsChange({
                  ...prefs,
                  sortField: option.field,
                  sortDirection: option.direction as TaxListSortDirection,
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
                {TAX_SORT_OPTIONS.map((option) => (
                  <SelectItem
                    key={taxSortOptionKey(option.field, option.direction)}
                    value={taxSortOptionKey(option.field, option.direction)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CatalogToolbarTrailingControls
            columnSettings={
              <TaxListColumnSettings
                prefs={prefs}
                onChange={onPrefsChange}
                detectedDeviceClass={deviceClass}
                disabled={controlsDisabled}
              />
            }
          />

          {canEdit && onLoadDefaults ? (
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
