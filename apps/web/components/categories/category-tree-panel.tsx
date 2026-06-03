"use client";

import { useState } from "react";
import { CategoryTreeNodeRow } from "@/components/categories/category-tree-node";
import { Checkbox } from "@/components/ui/checkbox";
import type { CategoryTreeNode } from "@/lib/categories/types";
import { flattenTree } from "@/lib/categories/tree";

type Props = {
  filteredTree: CategoryTreeNode[];
  totalRows: number;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  onSelect: (id: string) => void;
  onBulkRowToggle: (id: string, checked: boolean) => void;
  onBulkPageToggle: (checked: boolean) => void;
};

export function CategoryTreePanel({
  filteredTree,
  totalRows,
  selectedId,
  bulkSelectedIds,
  onSelect,
  onBulkRowToggle,
  onBulkPageToggle,
}: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const visibleNodes = flattenTree(filteredTree);
  const visibleIds = visibleNodes.map((node) => node.id);
  const pageAllSelected =
    visibleIds.length > 0 && visibleIds.every((id) => bulkSelectedIds.has(id));
  const pageSomeSelected =
    visibleIds.some((id) => bulkSelectedIds.has(id)) && !pageAllSelected;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto overscroll-contain scrollbar-none px-0.5 pt-2">
      {visibleIds.length > 0 ? (
        <div className="mb-2 flex items-center gap-2 px-2">
          <Checkbox
            checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false}
            onCheckedChange={(checked) => {
              onBulkPageToggle(checked === true);
            }}
            aria-label="Select all visible categories"
          />
          <span className="text-xs text-muted-foreground">Select visible</span>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 space-y-1 pb-2">
        {filteredTree.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            {totalRows === 0 ? "No categories yet." : "No categories match your search."}
          </p>
        ) : (
          filteredTree.map((node: CategoryTreeNode) => (
            <CategoryTreeNodeRow
              key={node.id}
              node={node}
              selectedId={selectedId}
              bulkSelectedIds={bulkSelectedIds}
              onSelect={onSelect}
              onBulkRowToggle={onBulkRowToggle}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
            />
          ))
        )}
      </div>
    </div>
  );
}
