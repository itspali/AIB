"use client";

import { useMemo } from "react";
import { ProductListSkeleton } from "@/components/products/product-list-skeleton";
import { ItemsMasterFeedCard } from "@/components/items/revamp/items-master-feed-card";
import { filterProductListRowsByFeedQuery } from "@/lib/products/feed-filter";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import { productListRowKey } from "@/lib/products/list-row-key";
import type { ProductListRow } from "@/lib/products/types";

type Props = {
  products: ProductListRow[];
  columns: ProductListColumnId[];
  loading?: boolean;
  selectedId: string | null;
  selectedVariantId: string | null;
  onSelect: (productId: string, variantId?: string | null) => void;
  emptyMessage?: string;
  filterQuery?: string;
  effectiveExpandVariants?: boolean;
  bulkSelectedIds?: Set<string>;
  onBulkRowToggle?: (rowKey: string, checked: boolean) => void;
};

function rowKey(row: ProductListRow): string {
  return `${row.id}:${row.variant_id ?? ""}`;
}

function isRowSelected(
  row: ProductListRow,
  selectedId: string | null,
  selectedVariantId: string | null
): boolean {
  if (!selectedId || row.id !== selectedId) return false;
  return (row.variant_id?.trim() || null) === selectedVariantId;
}

export function ItemsMasterFeed({
  products,
  columns,
  loading = false,
  selectedId,
  selectedVariantId,
  onSelect,
  emptyMessage = "No items match the current filter.",
  filterQuery = "",
  effectiveExpandVariants = false,
  bulkSelectedIds,
  onBulkRowToggle,
}: Props) {
  const filteredProducts = useMemo(
    () => filterProductListRowsByFeedQuery(products, filterQuery),
    [products, filterQuery]
  );

  const bulkEnabled = Boolean(bulkSelectedIds && onBulkRowToggle);

  return (
    <div className="spatial-master-feed-pane">
      <div className="spatial-feed-scroll pt-2">
        {loading ? (
          <ProductListSkeleton viewMode="compact" />
        ) : filteredProducts.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          filteredProducts.map((product) => {
            const bulkKey = productListRowKey(product, effectiveExpandVariants);
            return (
              <ItemsMasterFeedCard
                key={rowKey(product)}
                product={product}
                columns={columns}
                showVariants={effectiveExpandVariants}
                active={isRowSelected(product, selectedId, selectedVariantId)}
                bulkSelected={bulkEnabled ? bulkSelectedIds!.has(bulkKey) : false}
                onBulkToggle={
                  bulkEnabled ? (checked) => onBulkRowToggle!(bulkKey, checked) : undefined
                }
                onSelect={() => onSelect(product.id, product.variant_id ?? null)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
