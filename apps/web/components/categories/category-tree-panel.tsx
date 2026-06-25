"use client";

import { useEffect, useMemo, useState } from "react";
import { CategoryTreeNodeRow } from "@/components/categories/category-tree-node";
import type { CategoryListColumnId } from "@/lib/categories/list-columns";
import type { CategoryListRow } from "@/lib/categories/list-row";
import type { CategoryTreeNode } from "@/lib/categories/types";
import { collectExpandableCategoryIds } from "@/lib/categories/tree";

type Props = {
  filteredTree: CategoryTreeNode[];
  totalRows: number;
  listRowById: Map<string, CategoryListRow>;
  metaColumns: CategoryListColumnId[];
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  onSelect: (id: string) => void;
  onBulkRowToggle: (id: string, checked: boolean) => void;
};

export function CategoryTreePanel({
  filteredTree,
  totalRows,
  listRowById,
  metaColumns,
  selectedId,
  bulkSelectedIds,
  onSelect,
  onBulkRowToggle,
}: Props) {
  const expandableIds = useMemo(
    () => collectExpandableCategoryIds(filteredTree),
    [filteredTree]
  );

  const [expandedIds, setExpandedIds] = useState<Set<string>>(expandableIds);

  useEffect(() => {
    setExpandedIds(expandableIds);
  }, [expandableIds]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="glass-v2-tree-scroll">
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
              listRowById={listRowById}
              metaColumns={metaColumns}
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
