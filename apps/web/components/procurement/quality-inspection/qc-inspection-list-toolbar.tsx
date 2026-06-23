"use client";

import { ArrowUpDown } from "lucide-react";
import { ListModuleToolbarRow } from "@/components/layout/list-module-toolbar-row";
import { QcInspectionListColumnSettings } from "@/components/procurement/quality-inspection/qc-inspection-list-column-settings";
import { ModuleListToolbarFilters } from "@/components/search/module-list-toolbar-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useDeviceClass } from "@/hooks/use-device-class";
import type { QcQueueListPrefs } from "@/lib/procurement/quality-inspection/list-prefs";
import {
  QC_QUEUE_LIST_SORT_OPTIONS,
  qcQueueSortOptionKey,
  type QcQueueListSortDirection,
} from "@/lib/procurement/quality-inspection/list-sort";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";
import {
  listToolbarSelectClass,
  listToolbarSortTriggerClass,
  listToolbarViewToggleShellClass,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

type Props = {
  prefs: QcQueueListPrefs;
  onPrefsChange: (prefs: QcQueueListPrefs) => void;
  locations: ProcurementLocationOption[];
  searchQuery: string;
  onSearchQueryChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  prefsHydrated?: boolean;
};

export function QcInspectionListToolbar({
  prefs,
  onPrefsChange,
  locations,
  searchQuery,
  onSearchQueryChange,
  resultCount,
  totalCount,
  prefsHydrated = true,
}: Props) {
  const { deviceClass } = useDeviceClass();
  const controlsDisabled = !prefsHydrated;
  const locationActive = Boolean(prefs.locationId);
  const sortValue = qcQueueSortOptionKey(prefs.sortField, prefs.sortDirection);
  const activeSortLabel =
    QC_QUEUE_LIST_SORT_OPTIONS.find(
      (option) => qcQueueSortOptionKey(option.field, option.direction) === sortValue
    )?.label ?? "Sort";

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun="line"
      countNounPlural="lines"
      controls={
        <>
          <Input
            value={searchQuery}
            disabled={controlsDisabled}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search item, GRN, PO…"
            className="hidden h-8 w-[12rem] md:inline-flex"
          />

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
                const option = QC_QUEUE_LIST_SORT_OPTIONS.find(
                  (entry) => qcQueueSortOptionKey(entry.field, entry.direction) === value
                );
                if (!option) return;
                onPrefsChange({
                  ...prefs,
                  sortField: option.field,
                  sortDirection: option.direction as QcQueueListSortDirection,
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
                {QC_QUEUE_LIST_SORT_OPTIONS.map((option) => (
                  <SelectItem
                    key={qcQueueSortOptionKey(option.field, option.direction)}
                    value={qcQueueSortOptionKey(option.field, option.direction)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <QcInspectionListColumnSettings
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
