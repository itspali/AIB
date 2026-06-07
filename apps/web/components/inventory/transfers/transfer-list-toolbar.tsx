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
import type { TransferListPrefs } from "@/lib/inventory/transfers/list-prefs";
import { stockTransferStatusLabel } from "@/lib/inventory/transfers/labels";
import type { StockTransferStatus, TransferLocationOption } from "@/lib/inventory/transfers/types";
import { listToolbarSelectClass } from "@/lib/layout/list-toolbar-chrome";

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

export function TransferListToolbar({
  prefs,
  onPrefsChange,
  locations,
  resultCount,
  totalCount,
  compactCountLabel = false,
  prefsHydrated = true,
}: Props) {
  const controlsDisabled = !prefsHydrated;
  const extraFilterCount =
    (prefs.status !== "all" ? 1 : 0) + (prefs.sourceLocationId ? 1 : 0);

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun="transfer"
      countNounPlural="transfers"
      compactCountLabel={compactCountLabel}
      controls={
        <ModuleListToolbarFilters
          extras={{
            extraFilterCount,
            onClearExtras: () =>
              onPrefsChange({ status: "all", sourceLocationId: null }),
            extraDropdownContent: (
              <div className="space-y-3 p-1">
                <div className="space-y-2">
                  <p className="px-2 text-xs font-medium text-muted-foreground">Status</p>
                  <Select
                    value={prefs.status}
                    disabled={controlsDisabled}
                    onValueChange={(value) =>
                      onPrefsChange({
                        ...prefs,
                        status: value as TransferListPrefs["status"],
                      })
                    }
                  >
                    <SelectTrigger className="h-8 w-full">
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_FILTER_OPTIONS.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status === "all"
                            ? "All statuses"
                            : stockTransferStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <p className="px-2 text-xs font-medium text-muted-foreground">
                    Source location
                  </p>
                  <Select
                    value={prefs.sourceLocationId ?? "all"}
                    disabled={controlsDisabled}
                    onValueChange={(value) =>
                      onPrefsChange({
                        ...prefs,
                        sourceLocationId: value === "all" ? null : value,
                      })
                    }
                  >
                    <SelectTrigger className={listToolbarSelectClass}>
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
                </div>
              </div>
            ),
          }}
        />
      }
    />
  );
}
