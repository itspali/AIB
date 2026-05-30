"use client";

import { LayoutList, Loader2, Table2 } from "lucide-react";
import { ModuleViewSelect } from "@/components/search/module-view-select";
import { OmnibarFilterChipBar } from "@/components/search/omnibar-filter-chip-bar";
import { ProductListColumnSettings } from "@/components/products/product-list-column-settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import type { DeviceClass, ProductListPrefs, ProductListViewMode } from "@/lib/products/list-prefs";
import {
  PRODUCT_LIST_SORT_OPTIONS,
  sortOptionKey,
} from "@/lib/products/list-sort";
import { listControlShellClassName } from "@/lib/products/list-control-shell";
import { cn } from "@/lib/utils";
type CategoryOption = {
  id: string;
  label: string;
};

type Props = {
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categoryOptions: CategoryOption[];
  prefs: ProductListPrefs;
  onPrefsChange: (prefs: ProductListPrefs) => void;
  fieldPermissions: ProductFieldPermissions;
  detectedDeviceClass: DeviceClass;
  resultCount: number;
  totalCount: number;
  prefsHydrated?: boolean;
  isSavingPrefs?: boolean;
  isSavingColumnPrefs?: boolean;
};

export function ProductListToolbar({
  categoryFilter,
  onCategoryFilterChange,
  categoryOptions,
  prefs,
  onPrefsChange,
  fieldPermissions,
  detectedDeviceClass,
  resultCount,
  totalCount,
  prefsHydrated = true,
  isSavingPrefs = false,
  isSavingColumnPrefs = false,
}: Props) {
  const controlsDisabled = !prefsHydrated || isSavingPrefs;

  const setViewMode = (viewMode: ProductListViewMode) => {
    if (controlsDisabled || prefs.viewMode === viewMode) return;
    onPrefsChange({ ...prefs, viewMode });
  };

  const sortValue = sortOptionKey(prefs.sortField, prefs.sortDirection);
  const allowedSortFields = new Set(fieldPermissions.allowedFields);
  const sortOptions = PRODUCT_LIST_SORT_OPTIONS.filter((option) =>
    allowedSortFields.has(option.field)
  );

  return (
    <div className="space-y-3">
      <div className={listControlShellClassName()}>
        <div className="flex w-full min-w-0 items-center gap-2">
          <ModuleViewSelect triggerClassName="w-[8.5rem] shrink-0" />
          <div className="min-w-0 flex-1">
            <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
              <SelectTrigger className="h-8 w-full [&>span]:truncate">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categoryOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {prefs.viewMode === "compact" ? (
            <Select
              value={sortValue}
              disabled={controlsDisabled}
              onValueChange={(value) => {
                const option = PRODUCT_LIST_SORT_OPTIONS.find(
                  (entry) => sortOptionKey(entry.field, entry.direction) === value
                );
                if (!option) return;
                onPrefsChange({
                  ...prefs,
                  sortField: option.field,
                  sortDirection: option.direction,
                });
              }}
            >
              <SelectTrigger
                className="hidden h-8 w-[9.5rem] shrink-0 sm:flex [&>span]:truncate"
                title="Sort products"
                aria-label="Sort products"
              >
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent align="end">
                {sortOptions.map((option) => (
                  <SelectItem
                    key={sortOptionKey(option.field, option.direction)}
                    value={sortOptionKey(option.field, option.direction)}
                  >
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}
          {prefs.viewMode === "table" ? (
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <Switch
                id="show-variants-toggle"
                checked={prefs.showVariants}
                disabled={controlsDisabled}
                onCheckedChange={(checked) =>
                  onPrefsChange({ ...prefs, showVariants: checked === true })
                }
                aria-label="Show variants"
              />
              <Label
                htmlFor="show-variants-toggle"
                className="cursor-pointer text-xs font-normal text-muted-foreground"
              >
                Show variants
              </Label>
            </div>
          ) : null}
          <div className="flex shrink-0 items-center gap-2">
            <div
              className="inline-flex h-8 items-center rounded-md border border-border bg-muted p-0.5"
              aria-busy={isSavingPrefs}
            >
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  "h-7 w-7 p-0 focus-visible:ring-1 focus-visible:ring-ring",
                  prefs.viewMode === "table"
                    ? "bg-background text-primary shadow-sm hover:bg-background hover:text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                disabled={controlsDisabled}
                onClick={() => setViewMode("table")}
                title="Table view"
                aria-label="Table view"
                aria-pressed={prefs.viewMode === "table"}
              >
                {isSavingPrefs && prefs.viewMode === "table" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Table2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className={cn(
                  "h-7 w-7 p-0 focus-visible:ring-1 focus-visible:ring-ring",
                  prefs.viewMode === "compact"
                    ? "bg-background text-primary shadow-sm hover:bg-background hover:text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
                disabled={controlsDisabled}
                onClick={() => setViewMode("compact")}
                title="Compact view"
                aria-label="Compact view"
                aria-pressed={prefs.viewMode === "compact"}
              >
                {isSavingPrefs && prefs.viewMode === "compact" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LayoutList className="h-4 w-4" />
                )}
              </Button>
            </div>
            <ProductListColumnSettings
              prefs={prefs}
              onChange={onPrefsChange}
              fieldPermissions={fieldPermissions}
              detectedDeviceClass={detectedDeviceClass}
              disabled={controlsDisabled}
              isSaving={isSavingColumnPrefs}
            />
          </div>
        </div>
      </div>

      <OmnibarFilterChipBar variant="inline" />

      <p className="text-xs text-muted-foreground">
        Showing {resultCount} of {totalCount}{" "}
        {prefs.viewMode === "table" && prefs.showVariants
          ? `row${totalCount === 1 ? "" : "s"}`
          : `product${totalCount === 1 ? "" : "s"}`}
        .
        {prefs.viewMode === "compact" ? " Use the sort control above." : ""}
      </p>
    </div>
  );
}
