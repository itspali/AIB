"use client";

import { useCallback, useMemo, useRef } from "react";
import {
  entityCategoryListCellClassName,
  entityCategoryListCellWrapClassName,
  renderEntityCategoryListCell,
} from "@/components/entity-categories/entity-category-list-cells";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
import {
  ListWorkspaceRegistryHeaderCell,
  ListWorkspaceRegistrySelectBodyCell,
  ListWorkspaceRegistrySelectHeaderCell,
  ListWorkspaceRegistryTableFrame,
} from "@/components/layout/list-workspace-registry-table";
import { Checkbox } from "@/components/ui/checkbox";
import type { DeviceClass } from "@/lib/layout/device-class";
import { getEntityCategoryListCellDisplayTexts } from "@/lib/entity-categories/list-column-display-text";
import {
  getEntityCategoryColumnDef,
  type EntityCategoryListColumnId,
} from "@/lib/entity-categories/list-columns";
import type { EntityCategoryListRow } from "@/lib/entity-categories/list-row";
import type { EntityCategoryListFrozenColumnCount } from "@/lib/entity-categories/list-prefs";
import {
  isSortableEntityCategoryColumn,
  toggleEntityCategoryColumnSort,
  type EntityCategoryListSortDirection,
  type EntityCategoryListSortField,
} from "@/lib/entity-categories/list-sort";
import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";
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
  workspace: EntityCategoryWorkspace;
  rows: EntityCategoryListRow[];
  columns: EntityCategoryListColumnId[];
  columnWrapModes?: Partial<Record<EntityCategoryListColumnId, TextWrapMode>>;
  columnChipDisplay?: Partial<Record<EntityCategoryListColumnId, ColumnChipDisplay>>;
  columnWidths?: Partial<Record<EntityCategoryListColumnId, number>>;
  deviceClass: DeviceClass;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  pageAllSelected: boolean;
  pageSomeSelected: boolean;
  sortField: EntityCategoryListSortField;
  sortDirection: EntityCategoryListSortDirection;
  frozenColumnCount: EntityCategoryListFrozenColumnCount;
  freezeColumnsAuto?: boolean;
  compactRows?: boolean;
  onSortChange: (field: EntityCategoryListSortField, direction: EntityCategoryListSortDirection) => void;
  onColumnWidthChange?: (columnId: EntityCategoryListColumnId, width: number | null) => void;
  onSelect: (categoryId: string) => void;
  onBulkRowToggle: (categoryId: string, checked: boolean) => void;
  onBulkPageToggle: (checked: boolean) => void;
};

function cellPadding(compactRows: boolean): string {
  return compactRows ? "p-1.5" : "p-2.5";
}

export function EntityCategoryListTable({
  workspace,
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
    frozenColumnCount: Math.min(
      frozenColumnCount,
      columns.length
    ) as EntityCategoryListFrozenColumnCount,
    freezeColumnsAuto,
    leadingColumnRef: selectionColumnRef,
    remeasureKey: `${rows.length}:${widthRemeasureKey}`,
  });
  const resolveAutoWidth = useCallback(
    (columnId: EntityCategoryListColumnId, index: number) => {
      const column = getEntityCategoryColumnDef(workspace, columnId);
      return resolveListColumnAutoWidth({
        column,
        deviceClass,
        headerElement: frozen.headerRefs.current[index],
        bodyTexts: rows.flatMap((row) => getEntityCategoryListCellDisplayTexts(columnId, row)),
        sortable: isSortableEntityCategoryColumn(columnId),
        measure: measureHintsFromValueKind(column, {
          statusBadge: columnId === "is_active",
        }),
      });
    },
    [deviceClass, frozen.headerRefs, rows, workspace]
  );
  const resize = useResizableListColumns({
    columns,
    columnWidths,
    deviceClass,
    getColumnDef: (columnId) => getEntityCategoryColumnDef(workspace, columnId),
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
                  const column = getEntityCategoryColumnDef(workspace, columnId);
                  const sortable = isSortableEntityCategoryColumn(columnId);
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
                        const next = toggleEntityCategoryColumnSort(
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
                        const column = getEntityCategoryColumnDef(workspace, columnId);
                        const sticky = frozen.getStickyCellProps(index, "body");
                        const widthStyles = resize.resolveWidthStyles(columnId, index);

                        return (
                          <td
                            key={columnId}
                            className={cn(
                              "overflow-visible",
                              cellPadding(compactRows),
                              entityCategoryListCellClassName(columnId),
                              column.align === "center" && "text-center",
                              column.align === "right" && "text-right",
                              sticky.className,
                              frozen.bodyCellClass(index, selected)
                            )}
                            style={mergeColumnCellStyles(sticky.style, widthStyles)}
                          >
                            <div className={entityCategoryListCellWrapClassName(columnId)}>
                              {renderEntityCategoryListCell(columnId, row, {
                                workspace,
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
