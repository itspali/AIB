"use client";

import { useCallback, useMemo, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
import {
  ListWorkspaceRegistryHeaderCell,
  ListWorkspaceRegistrySelectBodyCell,
  ListWorkspaceRegistrySelectHeaderCell,
  ListWorkspaceRegistryTableScroll,
} from "@/components/layout/list-workspace-registry-table";
import {
  productListCellWrapClassName,
  renderProductListCell,
} from "@/components/products/product-list-cells";
import { matrixRegistryHeaderLabel } from "@/lib/items/matrix-registry-columns";
import {
  matrixCellClass,
  matrixColumnTypography,
} from "@/lib/items/matrix-table-typography";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { DeviceClass } from "@/lib/layout/device-class";
import {
  LIST_TABLE_FROZEN_EDGE_SHADOW,
  LIST_WORKSPACE_BULK_CHECKBOX_CLASS,
  MATRIX_TABLE_COLUMN_RESIZE_HANDLE_CLASS,
  listWorkspaceRegistryTableClass,
  matrixTableAutoFitHorizontalPaddingPx,
} from "@/lib/layout/list-table-chrome";
import { getColumnResizeBounds, mergeColumnCellStyles } from "@/lib/list-columns/sizing";
import {
  LIST_SELECTION_COLUMN_Z_BODY,
  LIST_SELECTION_COLUMN_Z_HEADER,
  LIST_TABLE_HEADER_Z,
  useFrozenListColumns,
  type ListFrozenColumnCount,
} from "@/lib/list-columns/use-frozen-list-columns";
import { useResizableListColumns } from "@/lib/list-columns/use-resizable-list-columns";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import { resolveProductListColumnAutoWidth } from "@/lib/products/resolve-list-column-auto-width";
import {
  isSortableColumn,
  toggleColumnSort,
  type ProductListSortDirection,
  type ProductListSortField,
} from "@/lib/products/list-sort";
import type { ProductListRow } from "@/lib/products/types";
import { isProductListRowInactive, productListRowKey } from "@/lib/products/list-row-key";
import { isBlankMatrixDisplayValue } from "@/lib/layout/matrix-blank-value";
import { isProductListMatrixCellBlank } from "@/lib/products/list-column-display-text";
import { cn } from "@/lib/utils";

type MatrixTableProps = {
  products: ProductListRow[];
  columns: ProductListColumnId[];
  columnWrapModes?: Partial<Record<ProductListColumnId, TextWrapMode>>;
  columnChipDisplay?: Partial<Record<ProductListColumnId, ColumnChipDisplay>>;
  columnWidths?: Partial<Record<ProductListColumnId, number>>;
  deviceClass: DeviceClass;
  showVariants?: boolean;
  sortField: ProductListSortField;
  sortDirection: ProductListSortDirection;
  onSortChange: (sortField: ProductListSortField, sortDirection: ProductListSortDirection) => void;
  onColumnWidthChange?: (columnId: ProductListColumnId, width: number | null) => void;
  bulkSelectedIds: Set<string>;
  onBulkRowToggle: (rowKey: string, checked: boolean) => void;
  onBulkPageToggle: (checked: boolean) => void;
  selectedId: string | null;
  selectedVariantId: string | null;
  onSelect: (row: ProductListRow) => void;
  frozenColumnCount?: ListFrozenColumnCount;
  freezeColumnsAuto?: boolean;
  className?: string;
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

function matrixAutoFitMeasureOverrides(columnId: ProductListColumnId) {
  const tier = matrixColumnTypography(columnId);
  const matrixPadding = {
    headerPaddingPx: matrixTableAutoFitHorizontalPaddingPx(),
    bodyPaddingPx: matrixTableAutoFitHorizontalPaddingPx(),
  } as const;
  if (tier === "code" || tier === "numeric" || tier === "numeric-muted") {
    return { ...matrixPadding, mono: true, tabular: false } as const;
  }
  return matrixPadding;
}

export function ItemsMatrixTable({
  products,
  columns,
  columnWrapModes,
  columnChipDisplay,
  columnWidths,
  deviceClass,
  showVariants = false,
  sortField,
  sortDirection,
  onSortChange,
  onColumnWidthChange,
  bulkSelectedIds,
  onBulkRowToggle,
  onBulkPageToggle,
  selectedId,
  selectedVariantId,
  onSelect,
  frozenColumnCount = 0,
  freezeColumnsAuto = false,
  className,
}: MatrixTableProps) {
  const selectionColumnRef = useRef<HTMLTableCellElement | null>(null);
  const widthRemeasureKey = useMemo(
    () => JSON.stringify({ columnWidths, columnWrapModes }),
    [columnWidths, columnWrapModes]
  );
  const frozen = useFrozenListColumns({
    columnCount: columns.length,
    frozenColumnCount: Math.min(frozenColumnCount, columns.length) as ListFrozenColumnCount,
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
        headerLabel: matrixRegistryHeaderLabel(columnId),
        measureOverrides: matrixAutoFitMeasureOverrides(columnId),
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

  const handleHeaderSort = (field: ProductListColumnId) => {
    if (!isSortableColumn(field)) return;
    const next = toggleColumnSort(field, sortField, sortDirection);
    onSortChange(next.field, next.direction);
  };

  const displayedRowKeys = useMemo(
    () => products.map((row) => productListRowKey(row, showVariants)),
    [products, showVariants]
  );
  const pageAllSelected =
    displayedRowKeys.length > 0 &&
    displayedRowKeys.every((key) => bulkSelectedIds.has(key));
  const pageSomeSelected =
    displayedRowKeys.some((key) => bulkSelectedIds.has(key)) && !pageAllSelected;

  const selectionColumnShowsEdge =
    frozen.hasHorizontalScroll && frozen.effectiveFrozenCount === 0;

  const selectionHeaderClass = cn(
    selectionColumnShowsEdge && LIST_TABLE_FROZEN_EDGE_SHADOW
  );

  const selectionBodyEdgeClass = cn(
    selectionColumnShowsEdge && LIST_TABLE_FROZEN_EDGE_SHADOW
  );

  return (
    <ListWorkspaceRegistryTableScroll scrollRef={frozen.scrollContainerRef} className={className}>
      <table className={listWorkspaceRegistryTableClass()}>
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
              const headerLabel = matrixRegistryHeaderLabel(columnId);
              const { min, max } = getColumnResizeBounds(column, deviceClass);

              return (
                <ListWorkspaceRegistryHeaderCell
                  key={columnId}
                  label={headerLabel}
                  sortable={sortable}
                  active={isActiveSort}
                  sortDirection={sortDirection}
                  onSort={() => handleHeaderSort(columnId)}
                  align={
                    column.align === "right"
                      ? "right"
                      : columnId === "image"
                        ? "center"
                        : undefined
                  }
                  headerRef={(element) => {
                    frozen.headerRefs.current[index] = element;
                  }}
                  className={cn("relative", sticky.className, frozen.headerCellClass(index))}
                  style={mergeColumnCellStyles(
                    sticky.style,
                    widthStyles,
                    !isFrozen ? { zIndex: LIST_TABLE_HEADER_Z + (columns.length - index) } : {}
                  )}
                  resizeHandle={
                    onColumnWidthChange ? (
                      <ListColumnResizeHandle
                        className={MATRIX_TABLE_COLUMN_RESIZE_HANDLE_CLASS}
                        ariaLabel={`Resize ${headerLabel} column`}
                        getWidth={() => resize.getHeaderWidthPx(columnId, index)}
                        minWidth={min}
                        maxWidth={max}
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
          {products.map((row) => {
            const active = isRowSelected(row, selectedId, selectedVariantId);
            const bulkKey = productListRowKey(row, showVariants);
            const bulkSelected = bulkSelectedIds.has(bulkKey);
            const rowInactive = isProductListRowInactive(row, showVariants);
            return (
              <tr
                key={rowKey(row)}
                className={cn(
                  rowInactive && "matrix-table__row--inactive",
                  active && "matrix-table__row--active"
                )}
                onClick={() => onSelect(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(row);
                  }
                }}
                tabIndex={0}
                role="button"
                aria-pressed={active}
              >
                <ListWorkspaceRegistrySelectBodyCell
                  className={selectionBodyEdgeClass}
                  style={{ zIndex: LIST_SELECTION_COLUMN_Z_BODY }}
                >
                  <Checkbox
                    className={LIST_WORKSPACE_BULK_CHECKBOX_CLASS}
                    checked={bulkSelected}
                    onCheckedChange={(checked) => onBulkRowToggle(bulkKey, checked === true)}
                    aria-label={`Select ${row.name}${row.default_sku ? ` (${row.default_sku})` : ""}`}
                  />
                </ListWorkspaceRegistrySelectBodyCell>
                {columns.map((columnId, index) => {
                  const wrapMode = columnWrapModes?.[columnId];
                  const sticky = frozen.getStickyCellProps(index, "body");
                  const widthStyles = resize.resolveWidthStyles(columnId, index);
                  const blank = isProductListMatrixCellBlank(columnId, row, { showVariants });
                  return (
                    <td
                      key={columnId}
                      style={mergeColumnCellStyles(sticky.style, widthStyles)}
                      className={cn(
                        matrixCellClass(columnId, blank),
                        getColumnDef(columnId).align === "right" && "text-right",
                        columnId === "image" && "text-center",
                        sticky.className,
                        frozen.bodyCellClass(index, active)
                      )}
                    >
                      <div
                        className={cn(
                          "matrix-table__cell-content",
                          productListCellWrapClassName(columnId)
                        )}
                      >
                        {renderProductListCell(columnId, row, {
                          showVariants,
                          wrapMode,
                          chipDisplay: columnChipDisplay,
                          surface: "matrix",
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
    </ListWorkspaceRegistryTableScroll>
  );
}

type MatrixFieldProps = {
  label: string;
  value: string;
  mono?: boolean;
  hint?: string;
};

export function ItemsMatrixField({ label, value, mono = false, hint }: MatrixFieldProps) {
  if (isBlankMatrixDisplayValue(value)) return null;

  return (
    <div className="matrix-input-group">
      <span className="matrix-input-label">{label}</span>
      <div className={cn("matrix-field-display", mono && "matrix-field-display--mono")}>
        {value}
      </div>
      {hint ? <span className="matrix-form-hint">{hint}</span> : null}
    </div>
  );
}
