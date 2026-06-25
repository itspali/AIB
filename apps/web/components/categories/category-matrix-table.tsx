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
  categoryListCellWrapClassName,
  renderCategoryListCell,
} from "@/components/categories/category-list-cells";
import {
  matrixCellClass,
  matrixColumnTypography,
} from "@/lib/categories/matrix-table-typography";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { DeviceClass } from "@/lib/layout/device-class";
import {
  LIST_TABLE_FROZEN_EDGE_SHADOW,
  LIST_WORKSPACE_BULK_CHECKBOX_CLASS,
  MATRIX_TABLE_COLUMN_RESIZE_HANDLE_CLASS,
  listWorkspaceRegistryTableClass,
  matrixTableAutoFitHorizontalPaddingPx,
} from "@/lib/layout/list-table-chrome";
import { getCategoryListCellDisplayTexts, isCategoryListMatrixCellBlank } from "@/lib/categories/list-column-display-text";
import {
  getCategoryColumnDef,
  type CategoryListColumnId,
} from "@/lib/categories/list-columns";
import type { CategoryListRow } from "@/lib/categories/list-row";
import { getColumnResizeBounds, mergeColumnCellStyles } from "@/lib/list-columns/sizing";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  measureHintsFromValueKind,
  resolveListColumnAutoWidth,
} from "@/lib/list-columns/resolve-column-auto-width";
import {
  LIST_SELECTION_COLUMN_Z_BODY,
  LIST_SELECTION_COLUMN_Z_HEADER,
  LIST_TABLE_HEADER_Z,
  useFrozenListColumns,
  type ListFrozenColumnCount,
} from "@/lib/list-columns/use-frozen-list-columns";
import { useResizableListColumns } from "@/lib/list-columns/use-resizable-list-columns";
import {
  isSortableCategoryColumn,
  toggleCategoryColumnSort,
  type CategoryListSortDirection,
  type CategoryListSortField,
} from "@/lib/categories/list-sort";
import { cn } from "@/lib/utils";

type Props = {
  rows: CategoryListRow[];
  columns: CategoryListColumnId[];
  columnWrapModes?: Partial<Record<CategoryListColumnId, TextWrapMode>>;
  columnChipDisplay?: Partial<Record<CategoryListColumnId, ColumnChipDisplay>>;
  columnWidths?: Partial<Record<CategoryListColumnId, number>>;
  deviceClass: DeviceClass;
  sortField: CategoryListSortField;
  sortDirection: CategoryListSortDirection;
  onSortChange: (sortField: CategoryListSortField, sortDirection: CategoryListSortDirection) => void;
  onColumnWidthChange?: (columnId: CategoryListColumnId, width: number | null) => void;
  bulkSelectedIds: Set<string>;
  onBulkRowToggle: (categoryId: string, checked: boolean) => void;
  onBulkPageToggle: (checked: boolean) => void;
  selectedId: string | null;
  onSelect: (categoryId: string) => void;
  frozenColumnCount?: ListFrozenColumnCount;
  freezeColumnsAuto?: boolean;
  className?: string;
};

function matrixAutoFitMeasureOverrides(columnId: CategoryListColumnId) {
  const tier = matrixColumnTypography(columnId);
  const matrixPadding = {
    headerPaddingPx: matrixTableAutoFitHorizontalPaddingPx(),
    bodyPaddingPx: matrixTableAutoFitHorizontalPaddingPx(),
  } as const;
  if (tier === "numeric" || tier === "numeric-muted") {
    return { ...matrixPadding, mono: true, tabular: false } as const;
  }
  return matrixPadding;
}

export function CategoryMatrixTable({
  rows,
  columns,
  columnWrapModes,
  columnChipDisplay,
  columnWidths,
  deviceClass,
  sortField,
  sortDirection,
  onSortChange,
  onColumnWidthChange,
  bulkSelectedIds,
  onBulkRowToggle,
  onBulkPageToggle,
  selectedId,
  onSelect,
  frozenColumnCount = 0,
  freezeColumnsAuto = false,
  className,
}: Props) {
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
    remeasureKey: `${rows.length}:${widthRemeasureKey}`,
  });

  const resolveAutoWidth = useCallback(
    (columnId: CategoryListColumnId, index: number) => {
      const column = getCategoryColumnDef(columnId);
      return resolveListColumnAutoWidth({
        column,
        deviceClass,
        headerElement: frozen.headerRefs.current[index],
        bodyTexts: rows.flatMap((row) => getCategoryListCellDisplayTexts(columnId, row)),
        sortable: isSortableCategoryColumn(columnId),
        measure: {
          ...measureHintsFromValueKind(column, {
            statusBadge: columnId === "is_active",
          }),
          tabular:
            columnId === "item_count" ||
            columnId === "attribute_count" ||
            columnId === "created_at" ||
            columnId === "updated_at",
          ...matrixAutoFitMeasureOverrides(columnId),
        },
      });
    },
    [deviceClass, frozen.headerRefs, rows]
  );

  const resize = useResizableListColumns({
    columns,
    columnWidths,
    deviceClass,
    getColumnDef: getCategoryColumnDef,
    headerRefs: frozen.headerRefs,
    wrapModeForColumn: (columnId) => columnWrapModes?.[columnId] ?? "truncate",
    resolveAutoWidth,
  });

  const displayedIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const pageAllSelected =
    displayedIds.length > 0 && displayedIds.every((id) => bulkSelectedIds.has(id));
  const pageSomeSelected =
    displayedIds.some((id) => bulkSelectedIds.has(id)) && !pageAllSelected;

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
                aria-label="Select all categories on this page"
              />
            </ListWorkspaceRegistrySelectHeaderCell>
            {columns.map((columnId, index) => {
              const column = getCategoryColumnDef(columnId);
              const sortable = isSortableCategoryColumn(columnId);
              const isActiveSort = sortable && sortField === columnId;
              const sticky = frozen.getStickyCellProps(index, "header");
              const widthStyles = resize.resolveWidthStyles(columnId, index);
              const isFrozen =
                frozen.effectiveFrozenCount > 0 && index < frozen.effectiveFrozenCount;
              const headerLabel = column.label.toUpperCase();
              const { min, max } = getColumnResizeBounds(column, deviceClass);

              return (
                <ListWorkspaceRegistryHeaderCell
                  key={columnId}
                  label={headerLabel}
                  sortable={sortable}
                  active={isActiveSort}
                  sortDirection={sortDirection}
                  onSort={() => {
                    const next = toggleCategoryColumnSort(
                      columnId,
                      sortField,
                      sortDirection
                    );
                    onSortChange(next.field, next.direction);
                  }}
                  align={column.align === "right" ? "right" : undefined}
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
                        ariaLabel={`Resize ${column.label} column`}
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
          {rows.map((row) => {
            const active = selectedId === row.id;
            const bulkSelected = bulkSelectedIds.has(row.id);

            return (
              <tr
                key={row.id}
                className={cn(
                  !row.is_active && "matrix-table__row--inactive",
                  active && "matrix-table__row--active"
                )}
                onClick={() => onSelect(row.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(row.id);
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
                    onCheckedChange={(checked) => onBulkRowToggle(row.id, checked === true)}
                    aria-label={`Select ${row.name}`}
                  />
                </ListWorkspaceRegistrySelectBodyCell>
                {columns.map((columnId, index) => {
                  const column = getCategoryColumnDef(columnId);
                  const sticky = frozen.getStickyCellProps(index, "body");
                  const widthStyles = resize.resolveWidthStyles(columnId, index);
                  const blank = isCategoryListMatrixCellBlank(columnId, row);

                  return (
                    <td
                      key={columnId}
                      style={mergeColumnCellStyles(sticky.style, widthStyles)}
                      className={cn(
                        matrixCellClass(columnId, blank),
                        column.align === "right" && "text-right",
                        sticky.className,
                        frozen.bodyCellClass(index, active)
                      )}
                    >
                      <div
                        className={cn(
                          "matrix-table__cell-content",
                          categoryListCellWrapClassName(columnId)
                        )}
                      >
                        {renderCategoryListCell(columnId, row, {
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
