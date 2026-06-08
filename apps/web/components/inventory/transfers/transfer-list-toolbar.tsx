"use client";

import { ArrowUpDown } from "lucide-react";
import { TransferListColumnSettings } from "@/components/inventory/transfers/transfer-list-column-settings";
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
import type { TransferListPrefs } from "@/lib/inventory/transfers/list-prefs";
import { stockTransferStatusLabel } from "@/lib/inventory/transfers/labels";
import {
  TRANSFER_LIST_SORT_OPTIONS,
  transferSortOptionKey,
  type TransferListSortDirection,
} from "@/lib/inventory/transfers/list-sort";
import type { StockTransferStatus, TransferLocationOption } from "@/lib/inventory/transfers/types";
import {
  listToolbarSelectClass,
  listToolbarSortTriggerClass,
  listToolbarViewToggleShellClass,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

const STATUS_FILTER_OPTIONS: Array<StockTransferStatus | "all"> = [
  "all",
  "DRAFT",
  "DISPATCHED_IN_TRANSIT",
  "FULLY_COMPLETED",
  "RECEIPT_DISCREPANCY",
  "CANCELLED",
];

type Props = {
  prefs: TransferListPrefs;
  onPrefsChange: (prefs: TransferListPrefs) => void;
  locations: TransferLocationOption[];
  resultCount: number;
  totalCount: number;
  compactCountLabel?: boolean;
  prefsHydrated?: boolean;
};

function StatusFilterSelect({
  value,
  disabled,
  onValueChange,
  triggerClassName,
}: {
  value: TransferListPrefs["status"];
  disabled: boolean;
  onValueChange: (value: TransferListPrefs["status"]) => void;
  triggerClassName?: string;
}) {
  const statusActive = value !== "all";

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next as TransferListPrefs["status"])}
    >
      <SelectTrigger className={cn(listToolbarSelectClass(statusActive), triggerClassName)}>
        <SelectValue placeholder="All statuses" />
      </SelectTrigger>
      <SelectContent>
        {STATUS_FILTER_OPTIONS.map((status) => (
          <SelectItem key={status} value={status}>
            {status === "all" ? "All statuses" : stockTransferStatusLabel(status)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SourceLocationFilterSelect({
  value,
  disabled,
  locations,
  onValueChange,
  triggerClassName,
}: {
  value: string | null;
  disabled: boolean;
  locations: TransferLocationOption[];
  onValueChange: (locationId: string | null) => void;
  triggerClassName?: string;
}) {
  const sourceActive = Boolean(value);

  return (
    <Select
      value={value ?? "all"}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next === "all" ? null : next)}
    >
      <SelectTrigger className={cn(listToolbarSelectClass(sourceActive), triggerClassName)}>
        <SelectValue placeholder="All sources" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All sources</SelectItem>
        {locations.map((location) => (
          <SelectItem key={location.id} value={location.id}>
            {location.name}
            {location.code ? ` (${location.code})` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TransferListToolbar({
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
  const statusActive = prefs.status !== "all";
  const sourceActive = Boolean(prefs.sourceLocationId);
  const extraFilterCount = (statusActive ? 1 : 0) + (sourceActive ? 1 : 0);

  const sortValue = transferSortOptionKey(prefs.sortField, prefs.sortDirection);
  const activeSortLabel =
    TRANSFER_LIST_SORT_OPTIONS.find(
      (option) => transferSortOptionKey(option.field, option.direction) === sortValue
    )?.label ?? "Sort";

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun="transfer"
      countNounPlural="transfers"
      compactCountLabel={compactCountLabel}
      controls={
        <>
          <ModuleListToolbarFilters
            extras={{
              extraFilterCount,
              onClearExtras: () =>
                onPrefsChange({ ...prefs, status: "all", sourceLocationId: null }),
              extraDropdownContent: (
                <div className="space-y-3 p-1">
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">Status</p>
                    <StatusFilterSelect
                      value={prefs.status}
                      disabled={controlsDisabled}
                      onValueChange={(status) => onPrefsChange({ ...prefs, status })}
                      triggerClassName="h-8 w-full"
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="px-2 text-xs font-medium text-muted-foreground">
                      Source location
                    </p>
                    <SourceLocationFilterSelect
                      value={prefs.sourceLocationId}
                      disabled={controlsDisabled}
                      locations={locations}
                      onValueChange={(sourceLocationId) =>
                        onPrefsChange({ ...prefs, sourceLocationId })
                      }
                      triggerClassName="h-8 w-full"
                    />
                  </div>
                </div>
              ),
            }}
          />

          <StatusFilterSelect
            value={prefs.status}
            disabled={controlsDisabled}
            onValueChange={(status) => onPrefsChange({ ...prefs, status })}
            triggerClassName="hidden md:inline-flex"
          />

          <SourceLocationFilterSelect
            value={prefs.sourceLocationId}
            disabled={controlsDisabled}
            locations={locations}
            onValueChange={(sourceLocationId) =>
              onPrefsChange({ ...prefs, sourceLocationId })
            }
            triggerClassName="hidden md:inline-flex"
          />

          <div className={cn(listToolbarViewToggleShellClass(), "inline-flex")}>
            <Select
              value={sortValue}
              disabled={controlsDisabled}
              onValueChange={(value) => {
                const option = TRANSFER_LIST_SORT_OPTIONS.find(
                  (entry) => transferSortOptionKey(entry.field, entry.direction) === value
                );
                if (!option) return;
                onPrefsChange({
                  ...prefs,
                  sortField: option.field,
                  sortDirection: option.direction as TransferListSortDirection,
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
                {TRANSFER_LIST_SORT_OPTIONS.map((option) => (
                  <SelectItem
                    key={transferSortOptionKey(option.field, option.direction)}
                    value={transferSortOptionKey(option.field, option.direction)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <TransferListColumnSettings
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
