"use client";

import { ArrowUpDown } from "lucide-react";
import { CatalogToolbarTrailingControls } from "@/components/layout/catalog-toolbar-trailing-controls";
import { ListModuleToolbarRow } from "@/components/layout/list-module-toolbar-row";
import { SoListColumnSettings } from "@/components/sales/orders/so-list-column-settings";
import { ModuleListToolbarFilters } from "@/components/search/module-list-toolbar-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeviceClass } from "@/hooks/use-device-class";
import type { SalesOrderListPrefs } from "@/lib/sales/orders/list-prefs";
import {
  SO_LIST_SORT_OPTIONS,
  salesOrderSortOptionKey,
  type SalesOrderListSortDirection,
} from "@/lib/sales/orders/list-sort";
import type { SalesOrderStatus } from "@/lib/sales/orders/types";
import { salesOrderStatusLabel } from "@/lib/sales/orders/labels";
import type { SalesLocationOption } from "@/lib/sales/shared/types";
import {
  listToolbarSelectClass,
  listToolbarSortTriggerClass,
  listToolbarViewToggleShellClass,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<SalesOrderStatus | "all"> = [
  "all",
  "DRAFT",
  "PENDING_APPROVAL",
  "CREDIT_HOLD",
  "APPROVED_ACTIVE",
  "PARTIALLY_SHIPPED",
  "FULLY_COMPLETED",
  "CANCELLED",
];

type Props = {
  prefs: SalesOrderListPrefs;
  onPrefsChange: (prefs: SalesOrderListPrefs) => void;
  locations: SalesLocationOption[];
  resultCount: number;
  totalCount: number;
  compactCountLabel?: boolean;
  hideCount?: boolean;
  prefsHydrated?: boolean;
};

function StatusFilterSelect({
  value,
  disabled,
  onValueChange,
  triggerClassName,
}: {
  value: SalesOrderListPrefs["status"];
  disabled: boolean;
  onValueChange: (value: SalesOrderListPrefs["status"]) => void;
  triggerClassName?: string;
}) {
  const statusActive = value !== "all";

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next as SalesOrderListPrefs["status"])}
    >
      <SelectTrigger className={cn(listToolbarSelectClass(statusActive), triggerClassName)}>
        <SelectValue placeholder="All statuses" />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((status) => (
          <SelectItem key={status} value={status}>
            {status === "all" ? "All statuses" : salesOrderStatusLabel(status)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function LocationFilterSelect({
  value,
  disabled,
  locations,
  onValueChange,
  triggerClassName,
}: {
  value: string | null;
  disabled: boolean;
  locations: SalesLocationOption[];
  onValueChange: (locationId: string | null) => void;
  triggerClassName?: string;
}) {
  const locationActive = Boolean(value);

  return (
    <Select
      value={value ?? "all"}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next === "all" ? null : next)}
    >
      <SelectTrigger className={cn(listToolbarSelectClass(locationActive), triggerClassName)}>
        <SelectValue placeholder="All ship-from locations" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All ship-from locations</SelectItem>
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

export function SoListToolbar({
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
  const statusActive = prefs.status !== "all";
  const locationActive = Boolean(prefs.locationId);
  const extraFilterCount = (statusActive ? 1 : 0) + (locationActive ? 1 : 0);
  const sortValue = salesOrderSortOptionKey(prefs.sortField, prefs.sortDirection);
  const activeSortLabel =
    SO_LIST_SORT_OPTIONS.find(
      (option) => salesOrderSortOptionKey(option.field, option.direction) === sortValue
    )?.label ?? "Sort";

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun="order"
      countNounPlural="orders"
      compactCountLabel={compactCountLabel}
      hideCount={hideCount}
      controls={
        <>
          <ModuleListToolbarFilters
            extras={{
              extraFilterCount,
              onClearExtras: () =>
                onPrefsChange({ ...prefs, status: "all", locationId: null }),
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
                    <p className="px-2 text-xs font-medium text-muted-foreground">Ship from</p>
                    <LocationFilterSelect
                      value={prefs.locationId}
                      disabled={controlsDisabled}
                      locations={locations}
                      onValueChange={(locationId) =>
                        onPrefsChange({ ...prefs, locationId })
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
            triggerClassName="hidden min-w-[8.5rem] md:inline-flex"
          />

          <LocationFilterSelect
            value={prefs.locationId}
            disabled={controlsDisabled}
            locations={locations}
            onValueChange={(locationId) => onPrefsChange({ ...prefs, locationId })}
            triggerClassName="hidden min-w-[8rem] md:inline-flex"
          />

          <div className={cn(listToolbarViewToggleShellClass(), "inline-flex")}>
            <Select
              value={sortValue}
              disabled={controlsDisabled}
              onValueChange={(value) => {
                const option = SO_LIST_SORT_OPTIONS.find(
                  (entry) => salesOrderSortOptionKey(entry.field, entry.direction) === value
                );
                if (!option) return;
                onPrefsChange({
                  ...prefs,
                  sortField: option.field,
                  sortDirection: option.direction as SalesOrderListSortDirection,
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
                {SO_LIST_SORT_OPTIONS.map((option) => (
                  <SelectItem
                    key={salesOrderSortOptionKey(option.field, option.direction)}
                    value={salesOrderSortOptionKey(option.field, option.direction)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CatalogToolbarTrailingControls
            columnSettings={
              <SoListColumnSettings
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
