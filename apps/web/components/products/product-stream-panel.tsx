"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductListCompact } from "@/components/products/product-list-compact";
import { ProductListTable } from "@/components/products/product-list-table";
import { ProductListToolbar } from "@/components/products/product-list-toolbar";
import { useOptionalOmnibarContext } from "@/components/search/omnibar-provider";
import { buildCategoryTree, flattenTree } from "@/lib/categories/tree";
import type { CategoryRow } from "@/lib/categories/types";
import { applyFallbackTextFilter } from "@/lib/search/executor/apply-fallback-text";
import {
  getOrderedVisibleColumns,
  loadProductListPrefs,
  saveProductListPrefs,
  type ProductListPrefs,
} from "@/lib/products/list-prefs";
import type { ProductListRow } from "@/lib/products/types";

type Props = {
  products: ProductListRow[];
  categories: CategoryRow[];
  selectedId: string | null;
  onSelect: (productId: string) => void;
};

export function ProductStreamPanel({ products, categories, selectedId, onSelect }: Props) {
  const omnibar = useOptionalOmnibarContext();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [prefs, setPrefs] = useState<ProductListPrefs>(() => loadProductListPrefs());

  useEffect(() => {
    saveProductListPrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    if (omnibar?.scopePinnedToAll) {
      setCategoryFilter("all");
    }
  }, [omnibar?.scopePinnedToAll, omnibar?.moduleFilterRevision]);

  const categoryOptions = useMemo(() => {
    const tree = buildCategoryTree(categories);
    return flattenTree(tree).map((node) => ({
      id: node.id,
      label: `${"— ".repeat(node.depth)}${node.name}`,
    }));
  }, [categories]);

  const filteredProducts = useMemo(() => {
    let rows = products;

    if (categoryFilter !== "all") {
      rows = rows.filter((product) => product.category_id === categoryFilter);
    }

    if (!omnibar?.appliedQuery.trim()) {
      return rows;
    }

    const hasStructuralFilter = omnibar.activeAst.some((clause) => clause.kind !== "text");

    if (hasStructuralFilter && omnibar.filteredItemIds) {
      rows = rows.filter((product) => omnibar.filteredItemIds?.has(product.id));
    } else if (!hasStructuralFilter && omnibar.residualText) {
      rows = applyFallbackTextFilter(
        rows.map((row) => ({ ...row, description: null })),
        omnibar.residualText
      );
    }

    return rows;
  }, [
    products,
    categoryFilter,
    omnibar?.appliedQuery,
    omnibar?.filteredItemIds,
    omnibar?.activeAst,
    omnibar?.residualText,
  ]);

  const visibleColumns = useMemo(() => getOrderedVisibleColumns(prefs), [prefs]);

  return (
    <div className="space-y-3">
      <ProductListToolbar
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        categoryOptions={categoryOptions}
        prefs={prefs}
        onPrefsChange={setPrefs}
        resultCount={filteredProducts.length}
        totalCount={products.length}
      />

      {filteredProducts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          {products.length === 0
            ? "No product profiles yet. Create your first master profile to populate the catalog."
            : "No products match the current filter."}
        </p>
      ) : prefs.viewMode === "compact" ? (
        <ProductListCompact
          products={filteredProducts}
          columns={visibleColumns}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      ) : (
        <ProductListTable
          products={filteredProducts}
          columns={visibleColumns}
          selectedId={selectedId}
          onSelect={onSelect}
        />
      )}
    </div>
  );
}
