"use client";

import { useMemo } from "react";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import type { CategoryRow } from "@/lib/categories/types";
import { filterCategoriesByAst } from "@/lib/search/executor/client-scopes";
import {
  buildEntityCategoryTree,
  filterEntityCategoryTree,
  flattenEntityCategoryTree,
} from "@/lib/entity-categories/tree";
import type { EntityCategoryRow, EntityCategoryTreeNode } from "@/lib/entity-categories/types";

type UseFilteredEntityCategoriesResult = {
  tree: EntityCategoryTreeNode[];
  filteredTree: EntityCategoryTreeNode[];
  filteredRows: EntityCategoryRow[];
  totalCount: number;
  resultCount: number;
};

export function useFilteredEntityCategories(
  rows: EntityCategoryRow[]
): UseFilteredEntityCategoriesResult {
  const omnibar = useOptionalOmnibarContext();

  const tree = useMemo(() => buildEntityCategoryTree(rows), [rows]);

  const filteredTree = useMemo(() => {
    const query = omnibar?.appliedQuery?.trim() ?? "";
    if (!query && !(omnibar?.activeAst.length ?? 0)) return tree;

    if (omnibar?.activeAst.length) {
      const filteredRows = filterCategoriesByAst(rows as CategoryRow[], omnibar.activeAst);
      const filteredIds = new Set(filteredRows.map((row) => row.id));
      return filterEntityCategoryTree(tree, "").filter((node) => filteredIds.has(node.id));
    }

    return filterEntityCategoryTree(tree, query);
  }, [tree, rows, omnibar?.appliedQuery, omnibar?.activeAst]);

  const filteredRows = useMemo(() => {
    const flat = flattenEntityCategoryTree(filteredTree);
    const byId = new Map(rows.map((row) => [row.id, row]));
    return flat
      .map((node) => byId.get(node.id))
      .filter((row): row is EntityCategoryRow => row != null);
  }, [filteredTree, rows]);

  return {
    tree,
    filteredTree,
    filteredRows,
    totalCount: rows.length,
    resultCount: filteredRows.length,
  };
}
