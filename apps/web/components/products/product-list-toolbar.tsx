"use client";

import { LayoutList, Table2 } from "lucide-react";
import { ProductListColumnSettings } from "@/components/products/product-list-column-settings";
import { Button } from "@/components/ui/button";
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
}: Props) {
  const setViewMode = (viewMode: ProductListViewMode) => {
    onPrefsChange({ ...prefs, viewMode });
  };

  const sortValue = sortOptionKey(prefs.sortField, prefs.sortDirection);
  const allowedSortFields = new Set(fieldPermissions.allowedFields);
  const sortOptions = PRODUCT_LIST_SORT_OPTIONS.filter((option) =>
    allowedSortFields.has(option.field)
  );

  return (
    <div className="space-y-3">
      <div className="flex w-full flex-nowrap items-center gap-2">
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

        <div className="flex shrink-0 items-center gap-2">
          {prefs.viewMode === "compact" ? (
            <Select
              value={sortValue}
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
                className="h-8 w-[9.5rem] [&>span]:truncate"
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
          <div className="inline-flex rounded-md border border-border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={prefs.viewMode === "table" ? "secondary" : "ghost"}
              className="h-8 w-8 p-0"
              onClick={() => setViewMode("table")}
              title="Table view"
              aria-label="Table view"
              aria-pressed={prefs.viewMode === "table"}
            >
              <Table2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant={prefs.viewMode === "compact" ? "secondary" : "ghost"}
              className="h-8 w-8 p-0"
              onClick={() => setViewMode("compact")}
              title="Compact view"
              aria-label="Compact view"
              aria-pressed={prefs.viewMode === "compact"}
            >
              <LayoutList className="h-4 w-4" />
            </Button>
          </div>
          <ProductListColumnSettings
            prefs={prefs}
            onChange={onPrefsChange}
            fieldPermissions={fieldPermissions}
            detectedDeviceClass={detectedDeviceClass}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {resultCount} of {totalCount} product{totalCount === 1 ? "" : "s"}.
        {prefs.viewMode === "table"
          ? " Click column headers to sort."
          : " Use the sort control above."}{" "}
        Use the header omnibar for native filters.
      </p>
    </div>
  );
}

