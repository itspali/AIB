"use client";

import type { CardGridColumnCount } from "@/lib/products/list-prefs";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListRow } from "@/lib/products/types";
import { isProductListRowSelected, productListRowKey } from "@/lib/products/list-row-key";
import { cn } from "@/lib/utils";
import { ProductListCompactCardV2 } from "@/components/products/product-list-compact-card-v2";
import { ProductListCompactCardShop } from "@/components/products/product-list-compact-card-shop";
import {
  isShopCardLayout,
  type ProductCardLayout,
  type ProductCardMetaDisplay,
  type ProductCardOrientation,
} from "@/lib/products/list-prefs";

type Props = {
  products: ProductListRow[];
  columns: ProductListColumnId[];
  columnWrapModes?: Partial<Record<ProductListColumnId, TextWrapMode>>;
  columnChipDisplay?: Partial<Record<ProductListColumnId, ColumnChipDisplay>>;
  gridColumns: CardGridColumnCount;
  cardLayout?: ProductCardLayout;
  cardOrientation?: ProductCardOrientation;
  cardMetaDisplay?: ProductCardMetaDisplay;
  showVariants?: boolean;
  selectedId: string | null;
  selectedVariantId?: string | null;
  bulkSelectedIds: Set<string>;
  onSelect: (productId: string, variantId?: string | null) => void;
  onProductHover?: (productId: string, variantId?: string | null) => void;
  onProductPointerEnter?: (productId: string, variantId?: string | null) => void;
  onBulkRowToggle: (rowKey: string, checked: boolean) => void;
  onImageClick?: (product: ProductListRow) => void;
};

const GRID_CLASS: Record<CardGridColumnCount, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
};

export function ProductListCompact({
  products,
  columns,
  columnWrapModes,
  columnChipDisplay,
  gridColumns,
  cardLayout = "v2",
  cardOrientation = "vertical",
  cardMetaDisplay = "labels",
  showVariants = false,
  selectedId,
  selectedVariantId = null,
  bulkSelectedIds,
  onSelect,
  onProductHover,
  onProductPointerEnter,
  onBulkRowToggle,
  onImageClick,
}: Props) {
  return (
    <div
      className={cn(
        "px-0.5 pb-0.5 pt-2",
        "grid [&>article]:min-w-0",
        isShopCardLayout(cardLayout) ? "gap-4" : "gap-3",
        GRID_CLASS[gridColumns]
      )}
    >
      {products.map((product) => {
        const rowKey = productListRowKey(product, showVariants);
        const cardProps = {
          product,
          columns,
          columnWrapModes,
          columnChipDisplay,
          orientation: cardOrientation,
          metaDisplay: cardMetaDisplay,
          showVariants,
          selected: isProductListRowSelected(
            product,
            selectedId,
            selectedVariantId,
            showVariants
          ),
          bulkSelected: bulkSelectedIds.has(rowKey),
          onSelect,
          onProductHover,
          onProductPointerEnter,
          onBulkToggle: (checked: boolean) => onBulkRowToggle(rowKey, checked),
          onImageClick,
        };
        if (cardLayout === "shop") {
          return <ProductListCompactCardShop key={rowKey} {...cardProps} />;
        }
        return <ProductListCompactCardV2 key={rowKey} {...cardProps} />;
      })}
    </div>
  );
}
