"use client";

import { useMemo } from "react";
import type { ProductListWorkspaceTableContext } from "@/components/items/product-list-workspace-host";
import { ItemsMatrixRegistry } from "@/components/items/revamp/items-matrix-registry";
import { ItemsMatrixTable } from "@/components/items/revamp/items-matrix-table";
import { ProductListSkeleton } from "@/components/products/product-list-skeleton";
import { filterProductListRowsByFeedQuery } from "@/lib/products/feed-filter";
import { productListRowKey } from "@/lib/products/list-row-key";

type Props = {
  table: ProductListWorkspaceTableContext;
  loading: boolean;
  selectedId: string | null;
  selectedVariantId: string | null;
  onSelect: (productId: string, variantId?: string | null) => void;
  catalogEmpty: boolean;
  emptyMessage: string;
  filterQuery?: string;
  bulkSelectedIds: Set<string>;
  onBulkRowToggle: (rowKey: string, checked: boolean) => void;
  onBulkPageToggle: (rowKeys: string[], checked: boolean) => void;
};

export function ItemsMatrixRegistryPane({
  table,
  loading,
  selectedId,
  selectedVariantId,
  onSelect,
  catalogEmpty,
  emptyMessage,
  filterQuery = "",
  bulkSelectedIds,
  onBulkRowToggle,
  onBulkPageToggle,
}: Props) {
  const filteredProducts = useMemo(
    () => filterProductListRowsByFeedQuery(table.displayedProducts, filterQuery),
    [table.displayedProducts, filterQuery]
  );

  const displayedRowKeys = useMemo(
    () => filteredProducts.map((row) => productListRowKey(row, table.effectiveExpandVariants)),
    [filteredProducts, table.effectiveExpandVariants]
  );

  return (
    <ItemsMatrixRegistry>
      {loading ? (
        <ProductListSkeleton viewMode="table" />
      ) : filteredProducts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          {catalogEmpty
            ? "No items yet. Create your first item profile to populate the catalog."
            : emptyMessage}
        </p>
      ) : (
        <ItemsMatrixTable
          products={filteredProducts}
          columns={table.visibleColumns}
          columnWrapModes={table.columnWrapModes}
          columnChipDisplay={table.columnChipDisplay}
          columnWidths={table.columnWidths}
          deviceClass={table.listDisplayDeviceClass}
          showVariants={table.effectiveExpandVariants}
          sortField={table.sortField}
          sortDirection={table.sortDirection}
          onSortChange={table.onSortChange}
          onColumnWidthChange={table.onColumnWidthChange}
          bulkSelectedIds={bulkSelectedIds}
          onBulkRowToggle={onBulkRowToggle}
          onBulkPageToggle={(checked) => onBulkPageToggle(displayedRowKeys, checked)}
          selectedId={selectedId}
          selectedVariantId={selectedVariantId}
          onSelect={(row) => onSelect(row.id, row.variant_id ?? null)}
          frozenColumnCount={table.frozenColumnCount}
          freezeColumnsAuto={table.freezeColumnsAuto}
        />
      )}
    </ItemsMatrixRegistry>
  );
}
