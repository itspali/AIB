"use client";

import { ArrowUpDown } from "lucide-react";
import { CatalogToolbarTrailingControls } from "@/components/layout/catalog-toolbar-trailing-controls";
import { ListModuleToolbarRow } from "@/components/layout/list-module-toolbar-row";
import { PoListColumnSettings } from "@/components/procurement/purchase-orders/po-list-column-settings";
import { ModuleListToolbarFilters } from "@/components/search/module-list-toolbar-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeviceClass } from "@/hooks/use-device-class";
import type { PurchaseOrderListPrefs } from "@/lib/procurement/purchase-orders/list-prefs";
import {
  PO_LIST_SORT_OPTIONS,
  purchaseOrderSortOptionKey,
  type PurchaseOrderListSortDirection,
} from "@/lib/procurement/purchase-orders/list-sort";
import type { PurchaseOrderStatus } from "@/lib/procurement/purchase-orders/types";
import { purchaseOrderStatusLabel } from "@/lib/procurement/purchase-orders/labels";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";
import {
  listToolbarSelectClass,
  listToolbarSortTriggerClass,
  listToolbarViewToggleShellClass,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<PurchaseOrderStatus | "all"> = [
  "all",
  "DRAFT",
  "PENDING_APPROVAL",
  "ISSUED_ACTIVE",
  "PARTIALLY_FULFILLED",
  "FULLY_COMPLETED",
];

type Props = {
  prefs: PurchaseOrderListPrefs;
  onPrefsChange: (prefs: PurchaseOrderListPrefs) => void;
  locations: ProcurementLocationOption[];
  resultCount: number;
  totalCount: number;
  compactCountLabel?: boolean;
  prefsHydrated?: boolean;
  hideCount?: boolean;
};

function StatusFilterSelect({
  value,
  disabled,
  onValueChange,
  triggerClassName,
}: {
  value: PurchaseOrderListPrefs["status"];
  disabled: boolean;
  onValueChange: (value: PurchaseOrderListPrefs["status"]) => void;
  triggerClassName?: string;
}) {
  const statusActive = value !== "all";

  return (
    <Select
      value={value}
      disabled={disabled}
      onValueChange={(next) => onValueChange(next as PurchaseOrderListPrefs["status"])}
    >
      <SelectTrigger className={cn(listToolbarSelectClass(statusActive), triggerClassName)}>
        <SelectValue placeholder="All statuses" />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((status) => (
          <SelectItem key={status} value={status}>
            {status === "all" ? "All statuses" : purchaseOrderStatusLabel(status)}
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
  locations: ProcurementLocationOption[];
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
  );
}

export function PoListToolbar({
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
  const statusActive = prefs.status !== "all";
  const locationActive = Boolean(prefs.locationId);
  const extraFilterCount = (statusActive ? 1 : 0) + (locationActive ? 1 : 0);
  const sortValue = purchaseOrderSortOptionKey(prefs.sortField, prefs.sortDirection);
  const activeSortLabel =
    PO_LIST_SORT_OPTIONS.find(
      (option) => purchaseOrderSortOptionKey(option.field, option.direction) === sortValue
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
                    <p className="px-2 text-xs font-medium text-muted-foreground">Location</p>
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
                const option = PO_LIST_SORT_OPTIONS.find(
                  (entry) => purchaseOrderSortOptionKey(entry.field, entry.direction) === value
                );
                if (!option) return;
                onPrefsChange({
                  ...prefs,
                  sortField: option.field,
                  sortDirection: option.direction as PurchaseOrderListSortDirection,
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
                {PO_LIST_SORT_OPTIONS.map((option) => (
                  <SelectItem
                    key={purchaseOrderSortOptionKey(option.field, option.direction)}
                    value={purchaseOrderSortOptionKey(option.field, option.direction)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CatalogToolbarTrailingControls
            columnSettings={
              <PoListColumnSettings
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
