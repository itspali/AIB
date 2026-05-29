"use client";

import { Search } from "lucide-react";
import { ProductListColumnSettings } from "@/components/products/product-list-column-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  query: string;
  onQueryChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categoryOptions: CategoryOption[];
  prefs: ProductListPrefs;
  onPrefsChange: (prefs: ProductListPrefs) => void;
  resultCount: number;
  totalCount: number;
};

export function ProductListToolbar({
  query,
  onQueryChange,
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
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search name, SKU, or category…"
            className="pl-9"
          />
        </div>

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

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border p-0.5">
            <Button
              type="button"
              size="sm"
              variant={prefs.viewMode === "table" ? "secondary" : "ghost"}
              className="h-8 px-3"
              onClick={() => setViewMode("table")}
            >
              Table
            </Button>
            <Button
              type="button"
              size="sm"
              variant={prefs.viewMode === "compact" ? "secondary" : "ghost"}
              className="h-8 px-3"
              onClick={() => setViewMode("compact")}
            >
              Compact
            </Button>
          </div>
          <ProductListColumnSettings prefs={prefs} onChange={onPrefsChange} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Showing {resultCount} of {totalCount} product{totalCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}
