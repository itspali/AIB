"use client";

import type { CardGridColumnCount } from "@/lib/products/list-prefs";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";
import { ProductListCompactCard } from "@/components/products/product-list-compact-card";

type Props = {
  products: ProductListRow[];
  columns: ProductListColumnId[];
  columnWrapModes?: Partial<Record<ProductListColumnId, TextWrapMode>>;
  gridColumns: CardGridColumnCount;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  onSelect: (productId: string) => void;
  onBulkRowToggle: (productId: string, checked: boolean) => void;
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
  selectedId,
  bulkSelectedIds,
  onSelect,
  onBulkRowToggle,
  onImageClick,
}: Props) {
  return (
    <div className={cn("grid gap-3", GRID_CLASS[gridColumns])}>
      {products.map((product) => (
        <ProductListCompactCard
          key={product.id}
          product={product}
          columns={columns}
          columnWrapModes={columnWrapModes}
          selected={selectedId === product.id}
          bulkSelected={bulkSelectedIds.has(product.id)}
          onSelect={onSelect}
          onBulkToggle={onBulkRowToggle}
          onImageClick={onImageClick}
        />
      ))}
    </div>
  );
}
