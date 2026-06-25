"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  categoryListCellClassName,
  categoryListCellWrapClassName,
  renderCategoryListCell,
} from "@/components/categories/category-list-cells";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
import {
  ListWorkspaceRegistryHeaderCell,
  ListWorkspaceRegistrySelectBodyCell,
  ListWorkspaceRegistrySelectHeaderCell,
  ListWorkspaceRegistryTableFrame,
} from "@/components/layout/list-workspace-registry-table";
import { Checkbox } from "@/components/ui/checkbox";
import type { DeviceClass } from "@/lib/layout/device-class";
import { getCategoryListCellDisplayTexts } from "@/lib/categories/list-column-display-text";
import {
  getCategoryColumnDef,
  type CategoryListColumnId,
} from "@/lib/categories/list-columns";
import type { CategoryListRow } from "@/lib/categories/list-row";
import type { CategoryListFrozenColumnCount } from "@/lib/categories/list-prefs";
import {
  isSortableCategoryColumn,
  toggleCategoryColumnSort,
  type CategoryListSortDirection,
  type CategoryListSortField,
} from "@/lib/categories/list-sort";
import { getColumnResizeBounds, mergeColumnCellStyles } from "@/lib/list-columns/sizing";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
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
import {
  measureHintsFromValueKind,
  resolveListColumnAutoWidth,
} from "@/lib/list-columns/resolve-column-auto-width";
import { useResizableListColumns } from "@/lib/list-columns/use-resizable-list-columns";
import { cn } from "@/lib/utils";

type Props = {
  rows: CategoryListRow[];
  columns: CategoryListColumnId[];
  columnWrapModes?: Partial<Record<CategoryListColumnId, TextWrapMode>>;
  columnChipDisplay?: Partial<Record<CategoryListColumnId, ColumnChipDisplay>>;
  columnWidths?: Partial<Record<CategoryListColumnId, number>>;
  deviceClass: DeviceClass;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  pageAllSelected: boolean;
  pageSomeSelected: boolean;
  sortField: CategoryListSortField;
  sortDirection: CategoryListSortDirection;
  frozenColumnCount: CategoryListFrozenColumnCount;
  freezeColumnsAuto?: boolean;
  compactRows?: boolean;
  onSortChange: (field: CategoryListSortField, direction: CategoryListSortDirection) => void;
  onColumnWidthChange?: (columnId: CategoryListColumnId, width: number | null) => void;
  onSelect: (categoryId: string) => void;
  onBulkRowToggle: (categoryId: string, checked: boolean) => void;
  onBulkPageToggle: (checked: boolean) => void;
};

function cellPadding(compactRows: boolean): string {
  return compactRows ? "p-1.5" : "p-2.5";
}

export function CategoryListTable({
  rows,
  columns,
  columnWrapModes,
  columnChipDisplay,
  columnWidths,
  deviceClass,
  selectedId,
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
  onBulkRowToggle,
  onBulkPageToggle,
}: Props) {
  const selectionColumnRef = useRef<HTMLTableCellElement | null>(null);
  const widthRemeasureKey = useMemo(
    () => JSON.stringify({ columnWidths, columnWrapModes }),
    [columnWidths, columnWrapModes]
  );
  const frozen = useFrozenListColumns({
    columnCount: columns.length,
    frozenColumnCount: Math.min(frozenColumnCount, columns.length) as CategoryListFrozenColumnCount,
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
        measure: measureHintsFromValueKind(column, {
          statusBadge: columnId === "is_active",
        }),
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
                  className={cn(
                    "sticky left-0 top-0 isolate overflow-hidden",
                    selectionHeaderClass
                  )}
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

                  return (
                    <ListWorkspaceRegistryHeaderCell
                      key={columnId}
                      label={column.label}
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
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="p-6 text-center text-sm text-muted-foreground"
                  >
                    No categories match your search.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const selected = selectedId === row.id;
                  const bulkSelected = bulkSelectedIds.has(row.id);

                  return (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      role="button"
                      onClick={() => onSelect(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(row.id);
                        }
                      }}
                      className={listTableRowClass(selected, true, !row.is_active)}
                    >
                      <ListWorkspaceRegistrySelectBodyCell
                        className={selectionBodyEdgeClass}
                        style={{ zIndex: LIST_SELECTION_COLUMN_Z_BODY }}
                      >
                        <Checkbox
                          className={LIST_WORKSPACE_BULK_CHECKBOX_CLASS}
                          checked={bulkSelected}
                          onCheckedChange={(checked) =>
                            onBulkRowToggle(row.id, checked === true)
                          }
                          aria-label={`Select ${row.name}`}
                        />
                      </ListWorkspaceRegistrySelectBodyCell>
                      {columns.map((columnId, index) => {
                        const column = getCategoryColumnDef(columnId);
                        const sticky = frozen.getStickyCellProps(index, "body");
                        const widthStyles = resize.resolveWidthStyles(columnId, index);

                        return (
                          <td
                            key={columnId}
                            className={cn(
                              "overflow-visible",
                              cellPadding(compactRows),
                              categoryListCellClassName(columnId),
                              column.align === "center" && "text-center",
                              column.align === "right" && "text-right",
                              sticky.className,
                              frozen.bodyCellClass(index, selected)
                            )}
                            style={mergeColumnCellStyles(sticky.style, widthStyles)}
                          >
                            <div className={categoryListCellWrapClassName(columnId)}>
                              {renderCategoryListCell(columnId, row, {
                                chipDisplay: columnChipDisplay,
                              })}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
    </ListWorkspaceRegistryTableFrame>
  );
}
