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
import type { ProductListPrefs, ProductListViewMode } from "@/lib/products/list-prefs";

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
  resultCount: number;
  totalCount: number;
};

export function ProductListToolbar({
  categoryFilter,
  onCategoryFilterChange,
  categoryOptions,
  prefs,
  onPrefsChange,
  resultCount,
  totalCount,
}: Props) {
  const setViewMode = (viewMode: ProductListViewMode) => {
    onPrefsChange({ ...prefs, viewMode });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Select value={categoryFilter} onValueChange={onCategoryFilterChange}>
          <SelectTrigger className="w-full lg:w-52">
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

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
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
          <ProductListColumnSettings prefs={prefs} onChange={onPrefsChange} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {resultCount} of {totalCount} product{totalCount === 1 ? "" : "s"}. Use the header
        omnibar for native filters.
      </p>
    </div>
  );
}
