"use client";

import { ClipboardList, Table2 } from "lucide-react";
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
import type { StockListPrefs } from "@/lib/inventory/stock/list-prefs";
import type { StockListViewMode, StockLocationOption } from "@/lib/inventory/stock/types";
import {
  listToolbarSelectClass,
  listToolbarViewToggleSegmentClass,
  listToolbarViewToggleShellClass,
} from "@/lib/layout/list-toolbar-chrome";
import { cn } from "@/lib/utils";

type Props = {
  prefs: StockListPrefs;
  onPrefsChange: (prefs: StockListPrefs) => void;
  locations: StockLocationOption[];
  resultCount: number;
  totalCount: number;
  compactCountLabel?: boolean;
  prefsHydrated?: boolean;
};

export function StockListToolbar({
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

  const setViewMode = (viewMode: StockListViewMode) => {
    if (controlsDisabled || prefs.viewMode === viewMode) return;
    onPrefsChange({ ...prefs, viewMode });
  };

  const countNoun = prefs.viewMode === "balances" ? "balance" : "adjustment";
  const countNounPlural = prefs.viewMode === "balances" ? "balances" : "adjustments";

  return (
    <ListModuleToolbarRow
      resultCount={resultCount}
      totalCount={totalCount}
      countNoun={countNoun}
      countNounPlural={countNounPlural}
      compactCountLabel={compactCountLabel}
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
                          {location.code ? ` (${location.code})` : ""}
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
              className={cn(listToolbarSelectClass(locationActive), "hidden min-w-[8rem] md:inline-flex")}
            >
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

          <div className={cn(listToolbarViewToggleShellClass(), "inline-flex")}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={controlsDisabled}
              className={listToolbarViewToggleSegmentClass(prefs.viewMode === "balances")}
              onClick={() => setViewMode("balances")}
              aria-label="Balances view"
              title="Balances"
            >
              <Table2 className="h-3.5 w-3.5" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={controlsDisabled}
              className={listToolbarViewToggleSegmentClass(prefs.viewMode === "adjustments")}
              onClick={() => setViewMode("adjustments")}
              aria-label="Adjustments view"
              title="Adjustments"
            >
              <ClipboardList className="h-3.5 w-3.5" aria-hidden />
            </Button>
          </div>
        </>
      }
    />
  );
}
