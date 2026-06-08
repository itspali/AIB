"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
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
  LIST_TABLE_BODY_CELL,
  LIST_TABLE_FROZEN_EDGE_SHADOW,
  LIST_TABLE_CHECKBOX_CLASS,
  LIST_TABLE_HEADER_CELL_BG,
  LIST_TABLE_ROOT,
  LIST_TABLE_SCROLL,
  LIST_TABLE_SURFACE,
  listTableElementClass,
  listTableLeadingCellInteractionClass,
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

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: ProductListSortDirection;
}) {
  if (!active) {
    return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />;
  }
  if (direction === "asc") {
    return <ArrowUp className="h-3.5 w-3.5 text-primary" aria-hidden />;
  }
  return <ArrowDown className="h-3.5 w-3.5 text-primary" aria-hidden />;
}

const HEADER_HOVER =
  "hover:bg-[color-mix(in_srgb,hsl(var(--primary))_18%,hsl(var(--background)))] dark:hover:bg-[color-mix(in_srgb,hsl(var(--accent))_50%,hsl(var(--muted)))]";

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
    "w-10 p-0 font-medium text-muted-foreground",
    LIST_TABLE_HEADER_CELL_BG,
    selectionColumnShowsEdge && LIST_TABLE_FROZEN_EDGE_SHADOW
  );

  const selectionBodyClass = (selected: boolean) =>
    cn(
      "w-10 p-0 text-center",
      selectionColumnShowsEdge && LIST_TABLE_FROZEN_EDGE_SHADOW,
      listTableLeadingCellInteractionClass(selected)
    );

  return (
    <div className={LIST_TABLE_ROOT}>
      <div className={LIST_TABLE_SURFACE}>
        <div ref={frozen.scrollContainerRef} className={LIST_TABLE_SCROLL}>
          <table className={listTableElementClass("narrow", compactRows)}>
            <thead>
              <tr className="bg-muted text-left">
                <th
                  ref={selectionColumnRef}
                  className={cn(
                    "sticky left-0 top-0 isolate overflow-hidden rounded-tl-lg",
                    selectionHeaderClass
                  )}
                  style={{ zIndex: LIST_SELECTION_COLUMN_Z_HEADER }}
                >
                  <div className={cn("flex items-center justify-center", cellPadding(compactRows, "name"))}>
                    <Checkbox
                      className={LIST_TABLE_CHECKBOX_CLASS}
                      checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => onBulkPageToggle(checked === true)}
                      aria-label="Select all items on this page"
                    />
                  </div>
                </th>
                {columns.map((columnId, index) => {
                  const column = getColumnDef(columnId);
                  const sortable = isSortableColumn(columnId);
                  const isActiveSort = sortable && sortField === columnId;
                  const sticky = frozen.getStickyCellProps(index, "header");
                  const widthStyles = resize.resolveWidthStyles(columnId, index);
                  const isFrozen =
                    frozen.effectiveFrozenCount > 0 && index < frozen.effectiveFrozenCount;

                  return (
                    <th
                      key={columnId}
                      ref={(element) => {
                        frozen.headerRefs.current[index] = element;
                      }}
                      className={cn(
                        "relative sticky top-0 overflow-hidden p-0 font-medium text-muted-foreground",
                        sticky.className,
                        frozen.headerCellClass(index),
                        column.align === "center" && "text-center",
                        column.align === "right" && "text-right",
                        index === columns.length - 1 && "rounded-tr-lg"
                      )}
                      style={mergeColumnCellStyles(
                        sticky.style,
                        widthStyles,
                        !isFrozen ? { zIndex: LIST_TABLE_HEADER_Z + (columns.length - index) } : {}
                      )}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => {
                            const next = toggleColumnSort(columnId, sortField, sortDirection);
                            onSortChange(next.field, next.direction);
                          }}
                          className={cn(
                            "inline-flex w-full min-w-0 items-center gap-1.5 overflow-hidden transition-colors duration-[25ms] hover:text-foreground",
                            cellPadding(compactRows, columnId),
                            HEADER_HOVER,
                            column.align === "center" && "justify-center",
                            column.align === "right" && "justify-end",
                            isActiveSort && "text-foreground"
                          )}
                          aria-label={`Sort by ${column.label}${
                            isActiveSort
                              ? ` (${sortDirection === "asc" ? "ascending" : "descending"})`
                              : ""
                          }`}
                        >
                          <span className="truncate">{column.label}</span>
                          <span className="shrink-0">
                            <SortIndicator active={isActiveSort} direction={sortDirection} />
                          </span>
                        </button>
                      ) : (
                        <span className={cn("block truncate", cellPadding(compactRows, columnId))}>
                          {column.label}
                        </span>
                      )}
                      {onColumnWidthChange ? (
                        <ListColumnResizeHandle
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
                      ) : null}
                    </th>
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
                    className={cn(listTableRowClass(selected), rowInactive && "opacity-50")}
                  >
                    <td
                      className={cn("sticky left-0 isolate", LIST_TABLE_BODY_CELL, selectionBodyClass(selected))}
                      style={{ zIndex: LIST_SELECTION_COLUMN_Z_BODY }}
                    >
                      <div
                        className={cn(
                          "flex items-center justify-center",
                          cellPadding(compactRows, "name")
                        )}
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <Checkbox
                          className={LIST_TABLE_CHECKBOX_CLASS}
                          checked={bulkSelected}
                          onCheckedChange={(checked) =>
                            onBulkRowToggle(rowKey, checked === true)
                          }
                          aria-label={`Select ${product.name}${
                            product.default_sku ? ` (${product.default_sku})` : ""
                          }`}
                        />
                      </div>
                    </td>
                    {columns.map((columnId, index) => {
                      const column = getColumnDef(columnId);
                      const sticky = frozen.getStickyCellProps(index, "body");
                      const widthStyles = resize.resolveWidthStyles(columnId, index);

                      return (
                        <td
                          key={columnId}
                          className={cn(
                            LIST_TABLE_BODY_CELL,
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
        </div>
      </div>
    </div>
  );
}
