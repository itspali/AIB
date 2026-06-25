"use client";

import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryMasterFeedCard } from "@/components/categories/category-master-feed-card";
import { filterCategoryListRowsByFeedQuery } from "@/lib/categories/feed-filter";
import type { CategoryListColumnId } from "@/lib/categories/list-columns";
import type { CategoryListRow } from "@/lib/categories/list-row";

type Props = {
  rows: CategoryListRow[];
  columns: CategoryListColumnId[];
  loading?: boolean;
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  emptyMessage?: string;
  filterQuery?: string;
  bulkSelectedIds?: Set<string>;
  onBulkRowToggle?: (categoryId: string, checked: boolean) => void;
};

export function CategoryMasterFeed({
  rows,
  columns,
  loading = false,
  selectedId,
  onSelect,
  emptyMessage = "No categories match the current filter.",
  filterQuery = "",
  bulkSelectedIds,
  onBulkRowToggle,
}: Props) {
  const filteredRows = useMemo(
    () => filterCategoryListRowsByFeedQuery(rows, filterQuery),
    [rows, filterQuery]
  );

  const bulkEnabled = Boolean(bulkSelectedIds && onBulkRowToggle);

  return (
    <div className="spatial-master-feed-pane">
      <div className="spatial-feed-scroll pt-2">
        {loading ? (
          <Skeleton className="mx-2 h-24 w-auto shimmer" />
        ) : filteredRows.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          filteredRows.map((row) => (
            <CategoryMasterFeedCard
              key={row.id}
              row={row}
              columns={columns}
              active={selectedId === row.id}
              bulkSelected={bulkEnabled ? bulkSelectedIds!.has(row.id) : false}
              onBulkToggle={
                bulkEnabled ? (checked) => onBulkRowToggle!(row.id, checked) : undefined
              }
              onSelect={() => onSelect(row.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
