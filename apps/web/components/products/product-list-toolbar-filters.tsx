"use client";

import { X } from "lucide-react";
import { ModuleListToolbarFilters } from "@/components/search/module-list-toolbar-filters";

type CategoryOption = {
  id: string;
  label: string;
};

type Props = {
  categoryFilter: string;
  onCategoryFilterChange: (value: string) => void;
  categoryOptions: CategoryOption[];
};

export function ProductListToolbarFilters({
  categoryFilter,
  onCategoryFilterChange,
  categoryOptions,
}: Props) {
  const isCategoryFilterActive = categoryFilter !== "all";
  const categoryLabel =
    categoryOptions.find((option) => option.id === categoryFilter)?.label ??
    categoryFilter;

  return (
    <ModuleListToolbarFilters
      extras={
        isCategoryFilterActive
          ? {
              extraFilterCount: 1,
              onClearExtras: () => onCategoryFilterChange("all"),
              extraDropdownContent: (
                <div className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-0.5 pl-2 pr-1 text-[11px] text-primary">
                  <span className="truncate">
                    <span className="font-semibold uppercase tracking-wide">Category · </span>
                    {categoryLabel.trim()}
                  </span>
                  <button
                    type="button"
                    onClick={() => onCategoryFilterChange("all")}
                    className="shrink-0 rounded-full p-0.5 text-primary/70 transition-colors hover:bg-primary/10 hover:text-primary"
                    aria-label="Clear category filter"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ),
            }
          : undefined
      }
    />
  );
}
