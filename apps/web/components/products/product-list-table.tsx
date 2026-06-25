"use client";

import { useCallback, useMemo, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
import {
  ListWorkspaceRegistryHeaderCell,
  ListWorkspaceRegistrySelectBodyCell,
  ListWorkspaceRegistrySelectHeaderCell,
  ListWorkspaceRegistryTableFrame,
} from "@/components/layout/list-workspace-registry-table";
import type { DeviceClass } from "@/lib/layout/device-class";
import {
  getColumnResizeBounds,
  mergeColumnCellStyles,
} from "@/lib/list-columns/sizing";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListFrozenColumnCount } from "@/lib/products/list-prefs";
import {
  isSortableColumn,
  toggleColumnSort,
  type ProductListSortDirection,
  type ProductListSortField,
} from "@/lib/products/list-sort";
import type { ProductListRow } from "@/lib/products/types";
import {
  isProductListRowInactive,
  isProductListRowSelected,
  productListRowKey,
} from "@/lib/products/list-row-key";
import {
  LIST_TABLE_FROZEN_EDGE_SHADOW,
  LIST_WORKSPACE_BULK_CHECKBOX_CLASS,
  MATRIX_TABLE_COLUMN_RESIZE_HANDLE_CLASS,
  listTableElementClass,
  listTableRowClass,
} from "@/lib/layout/list-table-chrome";
import {
  LIST_SELECTION_COLUMN_Z_BODY,
  LIST_SELECTION_COLUMN_Z_HEADER,
  LIST_TABLE_HEADER_Z,
  useFrozenListColumns,
} from "@/lib/list-columns/use-frozen-list-columns";
import { useResizableListColumns } from "@/lib/list-columns/use-resizable-list-columns";
import { resolveProductListColumnAutoWidth } from "@/lib/products/resolve-list-column-auto-width";
import { cn } from "@/lib/utils";
import {
  productListCellClassName,
  productListCellWrapClassName,
  renderProductListCell,
} from "@/components/products/product-list-cells";

type Props = {
  products: ProductListRow[];
  columns: ProductListColumnId[];
  columnWrapModes?: Partial<Record<ProductListColumnId, TextWrapMode>>;
  columnChipDisplay?: Partial<Record<ProductListColumnId, ColumnChipDisplay>>;
  columnWidths?: Partial<Record<ProductListColumnId, number>>;
  deviceClass: DeviceClass;
  showVariants?: boolean;
  selectedId: string | null;
  selectedVariantId?: string | null;
  bulkSelectedIds: Set<string>;
  pageAllSelected: boolean;
  pageSomeSelected: boolean;
  sortField: ProductListSortField;
  sortDirection: ProductListSortDirection;
  frozenColumnCount: ProductListFrozenColumnCount;
  freezeColumnsAuto?: boolean;
  compactRows?: boolean;
  onSortChange: (field: ProductListSortField, direction: ProductListSortDirection) => void;
  onColumnWidthChange?: (columnId: ProductListColumnId, width: number | null) => void;
  onSelect: (productId: string, variantId?: string | null) => void;
  onProductHover?: (productId: string, variantId?: string | null) => void;
  onProductPointerEnter?: (productId: string, variantId?: string | null) => void;
  onBulkRowToggle: (rowKey: string, checked: boolean) => void;
  onBulkPageToggle: (checked: boolean) => void;
  onImageClick?: (product: ProductListRow) => void;
};

function cellPadding(compactRows: boolean, columnId: ProductListColumnId): string {
  if (columnId === "image") return compactRows ? "p-0.5" : "p-1";
  return compactRows ? "p-1.5" : "p-2.5";
}

export function ProductListTable({
  products,
  columns,
  columnWrapModes,
  columnChipDisplay,
  columnWidths,
  deviceClass,
  showVariants = false,
  selectedId,
  selectedVariantId = null,
  bulkSelectedIds,
  pageAllSelected,
  pageSomeSelected,
  sortField,
  sortDirection,
  frozenColumnCount,
  freezeColumnsAuto = false,
  compactRows = false,
  onSortChange,
  onColumnWidthChange,
  onSelect,
  onProductHover,
  onProductPointerEnter,
  onBulkRowToggle,
  onBulkPageToggle,
  onImageClick,
}: Props) {
  const selectionColumnRef = useRef<HTMLTableCellElement | null>(null);
  const widthRemeasureKey = useMemo(
    () => JSON.stringify({ columnWidths, columnWrapModes }),
    [columnWidths, columnWrapModes]
  );
  const frozen = useFrozenListColumns({
    columnCount: columns.length,
    frozenColumnCount: Math.min(frozenColumnCount, columns.length) as ProductListFrozenColumnCount,
    freezeColumnsAuto,
    leadingColumnRef: selectionColumnRef,
    remeasureKey: `${products.length}:${widthRemeasureKey}`,
  });
  const resolveAutoWidth = useCallback(
    (columnId: ProductListColumnId, index: number) =>
      resolveProductListColumnAutoWidth({
        columnId,
        products,
        deviceClass,
        showVariants,
        headerElement: frozen.headerRefs.current[index],
      }),
    [deviceClass, frozen.headerRefs, products, showVariants]
  );
  const resize = useResizableListColumns({
    columns,
    columnWidths,
    deviceClass,
    getColumnDef,
    headerRefs: frozen.headerRefs,
    wrapModeForColumn: (columnId) => columnWrapModes?.[columnId] ?? "truncate",
    resolveAutoWidth,
  });

  const selectionColumnShowsEdge =
    frozen.hasHorizontalScroll && frozen.effectiveFrozenCount === 0;

  const selectionHeaderClass = cn(
    selectionColumnShowsEdge && LIST_TABLE_FROZEN_EDGE_SHADOW
  );

  const selectionBodyEdgeClass = cn(
    selectionColumnShowsEdge && LIST_TABLE_FROZEN_EDGE_SHADOW
  );

  return (
    <ListWorkspaceRegistryTableFrame scrollRef={frozen.scrollContainerRef}>
          <table className={listTableElementClass("narrow", compactRows)}>
            <thead>
              <tr>
                <ListWorkspaceRegistrySelectHeaderCell
                  cellRef={selectionColumnRef}
                  className={selectionHeaderClass}
                  style={{ zIndex: LIST_SELECTION_COLUMN_Z_HEADER }}
                >
                  <Checkbox
                    className={LIST_WORKSPACE_BULK_CHECKBOX_CLASS}
                    checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false}
                    onCheckedChange={(checked) => onBulkPageToggle(checked === true)}
                    aria-label="Select all items on this page"
                  />
                </ListWorkspaceRegistrySelectHeaderCell>
                {columns.map((columnId, index) => {
                  const column = getColumnDef(columnId);
                  const sortable = isSortableColumn(columnId);
                  const isActiveSort = sortable && sortField === columnId;
                  const sticky = frozen.getStickyCellProps(index, "header");
                  const widthStyles = resize.resolveWidthStyles(columnId, index);
                  const isFrozen =
                    frozen.effectiveFrozenCount > 0 && index < frozen.effectiveFrozenCount;

                  return (
                    <ListWorkspaceRegistryHeaderCell
                      key={columnId}
                      label={column.label}
                      sortable={sortable}
                      active={isActiveSort}
                      sortDirection={sortDirection}
                      onSort={() => {
                        const next = toggleColumnSort(columnId, sortField, sortDirection);
                        onSortChange(next.field, next.direction);
                      }}
                      align={
                        column.align === "center"
                          ? "center"
                          : column.align === "right"
                            ? "right"
                            : undefined
                      }
                      headerRef={(element) => {
                        frozen.headerRefs.current[index] = element;
                      }}
                      className={cn(
                        "relative",
                        sticky.className,
                        frozen.headerCellClass(index)
                      )}
                      style={mergeColumnCellStyles(
                        sticky.style,
                        widthStyles,
                        !isFrozen ? { zIndex: LIST_TABLE_HEADER_Z + (columns.length - index) } : {}
                      )}
                      resizeHandle={
                        onColumnWidthChange ? (
                          <ListColumnResizeHandle
                            className={MATRIX_TABLE_COLUMN_RESIZE_HANDLE_CLASS}
                            ariaLabel={`Resize ${column.label} column`}
                            getWidth={() => resize.getHeaderWidthPx(columnId, index)}
                            minWidth={getColumnResizeBounds(column, deviceClass).min}
                            maxWidth={getColumnResizeBounds(column, deviceClass).max}
                            onPreview={(width) => resize.setPreviewWidth(columnId, width)}
                            onCommit={(width) => {
                              resize.clearPreviewWidth(columnId);
                              onColumnWidthChange(columnId, width);
                            }}
                            onAutoFit={() =>
                              resize.autoFitColumn(columnId, index, (width) =>
                                onColumnWidthChange(columnId, width)
                              )
                            }
                          />
                        ) : undefined
                      }
                    />
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const rowKey = productListRowKey(product, showVariants);
                const selected = isProductListRowSelected(
                  product,
                  selectedId,
                  selectedVariantId ?? null,
                  showVariants
                );
                const bulkSelected = bulkSelectedIds.has(rowKey);
                const rowInactive = isProductListRowInactive(product, showVariants);

                return (
                  <tr
                    key={rowKey}
                    tabIndex={0}
                    role="button"
                    onClick={() => onSelect(product.id, product.variant_id)}
                    onMouseEnter={() => onProductHover?.(product.id, product.variant_id)}
                    onPointerEnter={() => onProductPointerEnter?.(product.id, product.variant_id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(product.id, product.variant_id);
                      }
                    }}
                    className={listTableRowClass(selected, true, rowInactive)}
                  >
                    <ListWorkspaceRegistrySelectBodyCell
                      className={selectionBodyEdgeClass}
                      style={{ zIndex: LIST_SELECTION_COLUMN_Z_BODY }}
                    >
                      <Checkbox
                        className={LIST_WORKSPACE_BULK_CHECKBOX_CLASS}
                        checked={bulkSelected}
                        onCheckedChange={(checked) =>
                          onBulkRowToggle(rowKey, checked === true)
                        }
                        aria-label={`Select ${product.name}${
                          product.default_sku ? ` (${product.default_sku})` : ""
                        }`}
                      />
                    </ListWorkspaceRegistrySelectBodyCell>
                    {columns.map((columnId, index) => {
                      const column = getColumnDef(columnId);
                      const sticky = frozen.getStickyCellProps(index, "body");
                      const widthStyles = resize.resolveWidthStyles(columnId, index);

                      return (
                        <td
                          key={columnId}
                          className={cn(
                            "overflow-visible",
                            cellPadding(compactRows, columnId),
                            productListCellClassName(columnId),
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right",
                            sticky.className,
                            frozen.bodyCellClass(index, selected)
                          )}
                          style={mergeColumnCellStyles(sticky.style, widthStyles)}
                        >
                          <div className={productListCellWrapClassName(columnId)}>
                            {renderProductListCell(columnId, product, {
                              onImageClick,
                              showVariants,
                              wrapMode: columnWrapModes?.[columnId],
                              chipDisplay: columnChipDisplay,
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
    </ListWorkspaceRegistryTableFrame>
  );
}
