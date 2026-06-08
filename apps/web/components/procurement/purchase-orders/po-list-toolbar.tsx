"use client";

import { ListModuleToolbarRow } from "@/components/layout/list-module-toolbar-row";
import { ModuleListToolbarFilters } from "@/components/search/module-list-toolbar-filters";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PurchaseOrderListPrefs } from "@/lib/procurement/purchase-orders/list-prefs";
import type { PurchaseOrderStatus } from "@/lib/procurement/purchase-orders/types";
import { purchaseOrderStatusLabel } from "@/lib/procurement/purchase-orders/labels";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";
import { listToolbarSelectClass } from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS: Array<PurchaseOrderStatus | "all"> = [
  "all",
  "DRAFT",
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
}: Props) {
  const controlsDisabled = !prefsHydrated;
  const statusActive = prefs.status !== "all";
  const locationActive = Boolean(prefs.locationId);
  const extraFilterCount = (statusActive ? 1 : 0) + (locationActive ? 1 : 0);

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun="order"
      countNounPlural="orders"
      compactCountLabel={compactCountLabel}
      controls={
        <>
          <ModuleListToolbarFilters
            extras={{
              extraFilterCount,
              onClearExtras: () =>
                onPrefsChange({ status: "all", locationId: null }),
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
        </>
      }
    />
  );
}
