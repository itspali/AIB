"use client";

import { useCallback, useMemo, useRef } from "react";
import { renderEntityListCell } from "@/components/entities/entity-list-cells";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
import {
  ListWorkspaceRegistryHeaderCell,
  ListWorkspaceRegistrySelectBodyCell,
  ListWorkspaceRegistrySelectHeaderCell,
  ListWorkspaceRegistryTableFrame,
  ListWorkspaceRegistryBodyCell,
} from "@/components/layout/list-workspace-registry-table";
import { Checkbox } from "@/components/ui/checkbox";
import { useDeviceClass } from "@/hooks/use-device-class";
import { getEntityListCellDisplayTexts } from "@/lib/entities/list-column-display-text";
import { getEntityColumnDef, type EntityListColumnId } from "@/lib/entities/list-columns";
import type { EntityListFrozenColumnCount } from "@/lib/entities/list-prefs";
import {
  isSortableEntityColumn,
  toggleEntityColumnSort,
  type EntityListSortDirection,
  type EntityListSortField,
} from "@/lib/entities/list-sort";
import type { EntityListRow } from "@/lib/entities/types";
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
  resolveListFrozenColumnCount,
  useFrozenListColumns,
} from "@/lib/list-columns/use-frozen-list-columns";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  getColumnResizeBounds,
  mergeColumnCellStyles,
} from "@/lib/list-columns/sizing";
import {
  measureHintsFromValueKind,
  resolveListColumnAutoWidth,
} from "@/lib/list-columns/resolve-column-auto-width";
import { useResizableListColumns } from "@/lib/list-columns/use-resizable-list-columns";
import { cn } from "@/lib/utils";

type Props = {
  rows: EntityListRow[];
  columns: EntityListColumnId[];
  columnWidths?: Partial<Record<EntityListColumnId, number>>;
  columnChipDisplay?: Partial<Record<EntityListColumnId, ColumnChipDisplay>>;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  pageAllSelected: boolean;
  pageSomeSelected: boolean;
  sortField: EntityListSortField;
  sortDirection: EntityListSortDirection;
  frozenColumnCount: EntityListFrozenColumnCount;
  freezeColumnsAuto?: boolean;
  compactRows?: boolean;
  onColumnWidthChange?: (columnId: EntityListColumnId, width: number | null) => void;
  onSortChange: (field: EntityListSortField, direction: EntityListSortDirection) => void;
  onSelect: (entityId: string) => void;
  onBulkRowToggle: (entityId: string, checked: boolean) => void;
  onBulkPageToggle: (checked: boolean) => void;
};

export function EntityListTable({
  rows,
  columns,
  columnWidths,
  columnChipDisplay,
  selectedId,
  bulkSelectedIds,
  pageAllSelected,
  pageSomeSelected,
  sortField,
  sortDirection,
  frozenColumnCount,
  freezeColumnsAuto = false,
  compactRows = false,
  onColumnWidthChange,
  onSortChange,
  onSelect,
  onBulkRowToggle,
  onBulkPageToggle,
}: Props) {
  const { deviceClass } = useDeviceClass();
  const cellPadding = compactRows ? "p-1.5" : "p-2.5";
  const selectionColumnRef = useRef<HTMLTableCellElement | null>(null);
  const widthRemeasureKey = useMemo(
    () => JSON.stringify(columnWidths ?? {}),
    [columnWidths]
  );
  const resolvedFrozenCount = resolveListFrozenColumnCount(frozenColumnCount, deviceClass);
  const frozen = useFrozenListColumns({
    columnCount: columns.length,
    frozenColumnCount: resolvedFrozenCount,
    freezeColumnsAuto,
    leadingColumnRef: selectionColumnRef,
    remeasureKey: `${rows.length}:${widthRemeasureKey}`,
  });
  const resolveAutoWidth = useCallback(
    (columnId: EntityListColumnId, index: number) => {
      const column = getEntityColumnDef(columnId);
      return resolveListColumnAutoWidth({
        column,
        deviceClass,
        headerElement: frozen.headerRefs.current[index],
        bodyTexts: rows.flatMap((row) => getEntityListCellDisplayTexts(columnId, row)),
        sortable: isSortableEntityColumn(columnId),
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
    getColumnDef: getEntityColumnDef,
    headerRefs: frozen.headerRefs,
    resolveAutoWidth,
  });

  const handleHeaderSort = (field: EntityListColumnId) => {
    if (!isSortableEntityColumn(field)) return;
    const next = toggleEntityColumnSort(field, sortField, sortDirection);
    onSortChange(next.field, next.direction);
  };

  const selectionColumnShowsEdge =
    frozen.hasHorizontalScroll && frozen.effectiveFrozenCount === 0;

  const selectionHeaderClass = cn(selectionColumnShowsEdge && LIST_TABLE_FROZEN_EDGE_SHADOW);

  const selectionBodyEdgeClass = cn(
    selectionColumnShowsEdge && LIST_TABLE_FROZEN_EDGE_SHADOW
  );

  return (
    <ListWorkspaceRegistryTableFrame scrollRef={frozen.scrollContainerRef}>
          <table className={listTableElementClass("wide", compactRows)}>
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
                    aria-label="Select all listed entities"
                  />
                </ListWorkspaceRegistrySelectHeaderCell>
                {columns.map((columnId, index) => {
                  const column = getEntityColumnDef(columnId);
                  const sortable = isSortableEntityColumn(columnId);
                  const isActiveSort = sortField === columnId;
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
                      onSort={() => handleHeaderSort(columnId)}
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
                  No entities match your search.
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
                    className={listTableRowClass(selected, true, !row.is_active)}
                    onClick={() => onSelect(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(row.id);
                      }
                    }}
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
                      const column = getEntityColumnDef(columnId);
                      const sticky = frozen.getStickyCellProps(index, "body");
                      const widthStyles = resize.resolveWidthStyles(columnId, index);
                      return (
                        <ListWorkspaceRegistryBodyCell
                          key={columnId}
                          column={column}
                          columnId={columnId}
                          className={cn(
                            cellPadding,
                            sticky.className,
                            frozen.bodyCellClass(index, selected)
                          )}
                          style={mergeColumnCellStyles(sticky.style, widthStyles)}
                        >
                          {renderEntityListCell(columnId, row, { chipDisplay: columnChipDisplay })}
                        </ListWorkspaceRegistryBodyCell>
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
