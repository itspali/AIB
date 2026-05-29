"use client";

import { useEffect, useMemo, useState } from "react";
import { ProductListCompact } from "@/components/products/product-list-compact";
import { ProductListTable } from "@/components/products/product-list-table";
import { ProductListToolbar } from "@/components/products/product-list-toolbar";
import { buildCategoryTree, flattenTree } from "@/lib/categories/tree";
import type { CategoryRow } from "@/lib/categories/types";
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
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [prefs, setPrefs] = useState<ProductListPrefs>(() => loadProductListPrefs());

  useEffect(() => {
    saveProductListPrefs(prefs);
  }, [prefs]);

  const categoryOptions = useMemo(() => {
    const tree = buildCategoryTree(categories);
    return flattenTree(tree).map((node) => ({
      id: node.id,
      label: `${"— ".repeat(node.depth)}${node.name}`,
    }));
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return products.filter((product) => {
      if (categoryFilter !== "all" && product.category_id !== categoryFilter) {
        return false;
      }

      if (!q) return true;

      return (
        product.name.toLowerCase().includes(q) ||
        (product.default_sku?.toLowerCase().includes(q) ?? false) ||
        (product.category_name?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [products, query, categoryFilter]);

  const visibleColumns = useMemo(() => getOrderedVisibleColumns(prefs), [prefs]);

  return (
    <div className="space-y-3">
      <ProductListToolbar
        query={query}
        onQueryChange={setQuery}
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
