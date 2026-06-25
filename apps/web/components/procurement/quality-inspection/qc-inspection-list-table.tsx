"use client";

import { useCallback, useMemo, useRef } from "react";
import { renderQcInspectionListCell } from "@/components/procurement/quality-inspection/qc-inspection-list-cells";
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
import { getOrderedVisibleColumns } from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { getColumnResizeBounds, mergeColumnCellStyles } from "@/lib/list-columns/sizing";
import {
  measureHintsFromValueKind,
  resolveListColumnAutoWidth,
} from "@/lib/list-columns/resolve-column-auto-width";
import { useResizableListColumns } from "@/lib/list-columns/use-resizable-list-columns";
import {
  isAutoFrozenColumnPref,
  LIST_SELECTION_COLUMN_Z_BODY,
  LIST_SELECTION_COLUMN_Z_HEADER,
  LIST_TABLE_HEADER_Z,
  resolveListFrozenColumnCount,
  useFrozenListColumns,
} from "@/lib/list-columns/use-frozen-list-columns";
import { getQcQueueListCellDisplayTexts } from "@/lib/procurement/quality-inspection/list-column-display-text";
import {
  getQcQueueColumnDef,
  type QcQueueListColumnId,
} from "@/lib/procurement/quality-inspection/list-columns";
import {
  isSortableQcQueueColumn,
  toggleQcQueueColumnSort,
  type QcQueueListSortDirection,
  type QcQueueListSortField,
} from "@/lib/procurement/quality-inspection/list-sort";
import type { QcInspectionQueueRow } from "@/lib/procurement/quality-inspection/types";
import {
  LIST_TABLE_FROZEN_EDGE_SHADOW,
  LIST_WORKSPACE_BULK_CHECKBOX_CLASS,
  MATRIX_TABLE_COLUMN_RESIZE_HANDLE_CLASS,
  listTableElementClass,
  listTableRowClass,
} from "@/lib/layout/list-table-chrome";
import type { FrozenColumnPref } from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";

type Props = {
  rows: QcInspectionQueueRow[];
  columnPrefs: ListColumnPrefs<QcQueueListColumnId>;
  sortField: QcQueueListSortField;
  sortDirection: QcQueueListSortDirection;
  frozenColumnCount: FrozenColumnPref;
  onSortChange: (field: QcQueueListSortField, direction: QcQueueListSortDirection) => void;
  onColumnWidthChange?: (columnId: QcQueueListColumnId, width: number | null) => void;
  selectedId: string | null;
  selectedIds: Set<string>;
  onSelect: (goodsReceiptItemId: string) => void;
  onToggleSelected: (goodsReceiptItemId: string, checked: boolean) => void;
  onTogglePageSelected: (checked: boolean) => void;
  pageAllSelected: boolean;
};

export function QcInspectionListTable({
  rows,
  columnPrefs,
  sortField,
  sortDirection,
  frozenColumnCount,
  onSortChange,
  onColumnWidthChange,
  selectedId,
  selectedIds,
  onSelect,
  onToggleSelected,
  onTogglePageSelected,
  pageAllSelected,
}: Props) {
  const selectionColumnRef = useRef<HTMLTableCellElement | null>(null);
  const { deviceClass } = useDeviceClass();
  const columns = useMemo(() => getOrderedVisibleColumns(columnPrefs), [columnPrefs]);
  const widthRemeasureKey = useMemo(
    () => JSON.stringify(columnPrefs.columnWidths ?? {}),
    [columnPrefs.columnWidths]
  );
  const resolvedFrozenCount = resolveListFrozenColumnCount(frozenColumnCount, deviceClass);
  const frozen = useFrozenListColumns({
    columnCount: columns.length,
    frozenColumnCount: resolvedFrozenCount,
    freezeColumnsAuto: isAutoFrozenColumnPref(frozenColumnCount),
    leadingColumnRef: selectionColumnRef,
    remeasureKey: `${rows.length}:${widthRemeasureKey}`,
  });
  const resolveAutoWidth = useCallback(
    (columnId: QcQueueListColumnId, index: number) => {
      const column = getQcQueueColumnDef(columnId);
      return resolveListColumnAutoWidth({
        column,
        deviceClass,
        headerElement: frozen.headerRefs.current[index],
        bodyTexts: rows.flatMap((row) => getQcQueueListCellDisplayTexts(columnId, row)),
        sortable: isSortableQcQueueColumn(columnId),
        measure: measureHintsFromValueKind(column),
      });
    },
    [deviceClass, frozen.headerRefs, rows]
  );
  const resize = useResizableListColumns({
    columns,
    columnWidths: columnPrefs.columnWidths,
    deviceClass,
    getColumnDef: getQcQueueColumnDef,
    headerRefs: frozen.headerRefs,
    resolveAutoWidth,
  });

  const handleHeaderSort = (field: string) => {
    if (!isSortableQcQueueColumn(field)) return;
    const next = toggleQcQueueColumnSort(sortField, sortDirection, field);
    onSortChange(next.field, next.direction);
  };

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
          <table className={listTableElementClass("medium")}>
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
                    checked={pageAllSelected}
                    aria-label="Select all lines on this page"
                    onCheckedChange={(checked) => onTogglePageSelected(checked === true)}
                  />
                </ListWorkspaceRegistrySelectHeaderCell>
                {columns.map((columnId, index) => {
                  const column = getQcQueueColumnDef(columnId);
                  const active = sortField === columnId;
                  const sortable = isSortableQcQueueColumn(columnId);
                  const sticky = frozen.getStickyCellProps(index, "header");
                  const widthStyles = resize.resolveWidthStyles(columnId, index);
                  const isFrozen =
                    frozen.effectiveFrozenCount > 0 && index < frozen.effectiveFrozenCount;

                  return (
                    <ListWorkspaceRegistryHeaderCell
                      key={columnId}
                      label={column.label}
                      sortable={sortable}
                      active={active}
                      sortDirection={sortDirection}
                      onSort={() => handleHeaderSort(columnId)}
                      align={column.align === "right" ? "right" : undefined}
                      headerRef={(element) => {
                        frozen.headerRefs.current[index] = element;
                      }}
                      className={cn(
                        "relative",
                        sticky.className,
                        frozen.headerCellClass(index)
                      )}
                      style={{
                        ...mergeColumnCellStyles(sticky.style, widthStyles),
                        ...(!isFrozen
                          ? { zIndex: LIST_TABLE_HEADER_Z + (columns.length - index) }
                          : {}),
                      }}
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
              {rows.map((row) => {
                const selected = selectedId === row.id;
                const bulkSelected = selectedIds.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className={listTableRowClass(selected || bulkSelected)}
                    onClick={() => onSelect(row.id)}
                  >
                    <ListWorkspaceRegistrySelectBodyCell
                      className={selectionBodyEdgeClass}
                      style={{ zIndex: LIST_SELECTION_COLUMN_Z_BODY }}
                    >
                      <Checkbox
                        className={LIST_WORKSPACE_BULK_CHECKBOX_CLASS}
                        checked={bulkSelected}
                        aria-label={`Select ${row.variant_sku}`}
                        onCheckedChange={(checked) =>
                          onToggleSelected(row.id, checked === true)
                        }
                      />
                    </ListWorkspaceRegistrySelectBodyCell>
                    {columns.map((columnId, index) => {
                      const column = getQcQueueColumnDef(columnId);
                      const sticky = frozen.getStickyCellProps(index, "body");
                      const widthStyles = resize.resolveWidthStyles(columnId, index);
                      return (
                        <ListWorkspaceRegistryBodyCell
                          key={columnId}
                          column={column}
                          columnId={columnId}
                          className={cn(
                            sticky.className,
                            frozen.bodyCellClass(index, selected || bulkSelected)
                          )}
                          style={mergeColumnCellStyles(sticky.style, widthStyles)}
                        >
                          {renderQcInspectionListCell(columnId, row)}
                        </ListWorkspaceRegistryBodyCell>
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
