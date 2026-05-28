"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ProductSummaryCard } from "@/components/products/product-summary-card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buildCategoryTree, flattenTree } from "@/lib/categories/tree";
import type { CategoryRow } from "@/lib/categories/types";
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

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, SKU, or category…"
          className="pl-9"
        />
      </div>

      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger>
          <SelectValue placeholder="Filter by category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All categories</SelectItem>
          {categoryOptions.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="space-y-2">
        {filteredProducts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No products match the current filter.
          </p>
        ) : (
          filteredProducts.map((product) => (
            <ProductSummaryCard
              key={product.id}
              product={product}
              selected={selectedId === product.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
