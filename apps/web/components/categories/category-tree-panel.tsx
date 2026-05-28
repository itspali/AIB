"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CategoryTreeNodeRow } from "@/components/categories/category-tree-node";
import type { CategoryRow, CategoryTreeNode } from "@/lib/categories/types";
import { buildCategoryTree, filterCategoryTree } from "@/lib/categories/tree";

type Props = {
  rows: CategoryRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function CategoryTreePanel({ rows, selectedId, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const tree = useMemo(() => buildCategoryTree(rows), [rows]);
  const filteredTree = useMemo(() => filterCategoryTree(tree, query), [tree, query]);

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
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search categories…"
          className="pl-9"
        />
      </div>
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
