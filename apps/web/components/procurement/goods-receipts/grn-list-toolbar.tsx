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
import type { GoodsReceiptListPrefs } from "@/lib/procurement/goods-receipts/list-prefs";
import type { ProcurementLocationOption } from "@/lib/procurement/shared/types";

type Props = {
  prefs: GoodsReceiptListPrefs;
  onPrefsChange: (prefs: GoodsReceiptListPrefs) => void;
  locations: ProcurementLocationOption[];
  resultCount: number;
  totalCount: number;
  compactCountLabel?: boolean;
  prefsHydrated?: boolean;
};

export function GrnListToolbar({
  prefs,
  onPrefsChange,
  locations,
  resultCount,
  totalCount,
  compactCountLabel = false,
  prefsHydrated = true,
}: Props) {
  const controlsDisabled = !prefsHydrated;
  const locationActive = Boolean(prefs.locationId);

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun="receipt"
      countNounPlural="receipts"
      compactCountLabel={compactCountLabel}
      controls={
        <ModuleListToolbarFilters
          extras={{
            extraFilterCount: locationActive ? 1 : 0,
            onClearExtras: () => onPrefsChange({ locationId: null }),
            extraDropdownContent: (
              <div className="space-y-2 p-1">
                <p className="px-2 text-xs font-medium text-muted-foreground">Location</p>
                <Select
                  value={prefs.locationId ?? "all"}
                  disabled={controlsDisabled}
                  onValueChange={(value) =>
                    onPrefsChange({
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
      }
    />
  );
}
