"use client";

import { useMemo, useState } from "react";
import { CategoryTreeNodeRow } from "@/components/categories/category-tree-node";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import type { CategoryRow, CategoryTreeNode } from "@/lib/categories/types";
import { buildCategoryTree, filterCategoryTree } from "@/lib/categories/tree";
import { filterCategoriesByAst } from "@/lib/search/executor/client-scopes";

type Props = {
  rows: CategoryRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function CategoryTreePanel({ rows, selectedId, onSelect }: Props) {
  const omnibar = useOptionalOmnibarContext();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const tree = useMemo(() => buildCategoryTree(rows), [rows]);
  const filteredTree = useMemo(() => {
    const query = omnibar?.appliedQuery?.trim() ?? "";
    if (!query) return tree;

    if (omnibar?.scope === "categories" && omnibar.activeAst.length) {
      const filteredRows = filterCategoriesByAst(rows, omnibar.activeAst);
      const filteredIds = new Set(filteredRows.map((row) => row.id));
      return filterCategoryTree(tree, "").filter((node) => filteredIds.has(node.id));
    }

    return filterCategoryTree(tree, query);
  }, [tree, rows, omnibar?.scope, omnibar?.appliedQuery, omnibar?.activeAst]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <p className="text-xs text-muted-foreground">
        Filter categories using the header omnibar.
      </p>
      <div className="min-h-0 flex-1 space-y-1">
        {filteredTree.length === 0 ? (
          <p className="px-2 py-4 text-sm text-muted-foreground">
            {rows.length === 0 ? "No categories yet." : "No categories match your search."}
          </p>
        ) : (
          filteredTree.map((node: CategoryTreeNode) => (
            <CategoryTreeNodeRow
              key={node.id}
              node={node}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
            />
          ))
        )}
      </div>
    </div>
  );
}
