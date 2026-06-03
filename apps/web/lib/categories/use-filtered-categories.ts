"use client";

import { useMemo } from "react";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import type { CategoryRow, CategoryTreeNode } from "@/lib/categories/types";
import {
  buildCategoryTree,
  filterCategoryTree,
  flattenTree,
} from "@/lib/categories/tree";
import { filterCategoriesByAst } from "@/lib/search/executor/client-scopes";

type UseFilteredCategoriesResult = {
  tree: CategoryTreeNode[];
  filteredTree: CategoryTreeNode[];
  filteredRows: CategoryRow[];
  totalCount: number;
  resultCount: number;
};

export function useFilteredCategories(rows: CategoryRow[]): UseFilteredCategoriesResult {
  const omnibar = useOptionalOmnibarContext();

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

  const filteredRows = useMemo(() => {
    const flat = flattenTree(filteredTree);
    const byId = new Map(rows.map((row) => [row.id, row]));
    return flat
      .map((node) => byId.get(node.id))
      .filter((row): row is CategoryRow => row != null);
  }, [filteredTree, rows]);

  return {
    tree,
    filteredTree,
    filteredRows,
    totalCount: rows.length,
    resultCount: filteredRows.length,
  };
}
