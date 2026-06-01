"use client";

import type { CardGridColumnCount } from "@/lib/products/list-prefs";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListRow } from "@/lib/products/types";
import { productListRowKey } from "@/lib/products/list-row-key";
import { cn } from "@/lib/utils";
import { ProductListCompactCard } from "@/components/products/product-list-compact-card";

type Props = {
  products: ProductListRow[];
  columns: ProductListColumnId[];
  columnWrapModes?: Partial<Record<ProductListColumnId, TextWrapMode>>;
  gridColumns: CardGridColumnCount;
  showVariants?: boolean;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  onSelect: (productId: string) => void;
  onBulkRowToggle: (rowKey: string, checked: boolean) => void;
  onImageClick?: (product: ProductListRow) => void;
};

const GRID_CLASS: Record<CardGridColumnCount, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2 lg:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
};

export function ProductListCompact({
  products,
  columns,
  columnWrapModes,
  gridColumns,
  showVariants = false,
  selectedId,
  bulkSelectedIds,
  onSelect,
  onBulkRowToggle,
  onImageClick,
}: Props) {
  return (
    <div className={cn("grid gap-3", GRID_CLASS[gridColumns])}>
      {products.map((product) => {
        const rowKey = productListRowKey(product, showVariants);
        return (
        <ProductListCompactCard
          key={rowKey}
          product={product}
          columns={columns}
          columnWrapModes={columnWrapModes}
          showVariants={showVariants}
          selected={selectedId === product.id}
          bulkSelected={bulkSelectedIds.has(rowKey)}
          onSelect={onSelect}
          onBulkToggle={(checked) => onBulkRowToggle(rowKey, checked)}
          onImageClick={onImageClick}
        />
        );
      })}
    </div>
  );
}
