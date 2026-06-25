"use client";

import { useCallback, useMemo } from "react";
import { renderGoodsReceiptListCell } from "@/components/procurement/goods-receipts/grn-list-cells";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
import {
  ListWorkspaceRegistryHeaderCell,
  ListWorkspaceRegistryTableFrame,
  ListWorkspaceRegistryBodyCell,
} from "@/components/layout/list-workspace-registry-table";
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
  LIST_TABLE_HEADER_Z,
  resolveListFrozenColumnCount,
  useFrozenListColumns,
} from "@/lib/list-columns/use-frozen-list-columns";
import { getGoodsReceiptListCellDisplayTexts } from "@/lib/procurement/goods-receipts/list-column-display-text";
import {
  getGoodsReceiptColumnDef,
  type GoodsReceiptListColumnId,
} from "@/lib/procurement/goods-receipts/list-columns";
import {
  isSortableGoodsReceiptColumn,
  toggleGoodsReceiptColumnSort,
  type GoodsReceiptListSortDirection,
  type GoodsReceiptListSortField,
} from "@/lib/procurement/goods-receipts/list-sort";
import type { GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import {
  MATRIX_TABLE_COLUMN_RESIZE_HANDLE_CLASS,
  listTableElementClass,
  listTableRowClass,
} from "@/lib/layout/list-table-chrome";
import type { FrozenColumnPref } from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";

type Props = {
  rows: GoodsReceiptRow[];
  columnPrefs: ListColumnPrefs<GoodsReceiptListColumnId>;
  sortField: GoodsReceiptListSortField;
  sortDirection: GoodsReceiptListSortDirection;
  frozenColumnCount: FrozenColumnPref;
  onSortChange: (field: GoodsReceiptListSortField, direction: GoodsReceiptListSortDirection) => void;
  onColumnWidthChange?: (columnId: GoodsReceiptListColumnId, width: number | null) => void;
  selectedId: string | null;
  onSelect: (goodsReceiptId: string) => void;
};

export function GrnListTable({
  rows,
  columnPrefs,
  sortField,
  sortDirection,
  frozenColumnCount,
  onSortChange,
  onColumnWidthChange,
  selectedId,
  onSelect,
}: Props) {
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
    remeasureKey: `${rows.length}:${widthRemeasureKey}`,
  });
  const resolveAutoWidth = useCallback(
    (columnId: GoodsReceiptListColumnId, index: number) => {
      const column = getGoodsReceiptColumnDef(columnId);
      return resolveListColumnAutoWidth({
        column,
        deviceClass,
        headerElement: frozen.headerRefs.current[index],
        bodyTexts: rows.flatMap((row) => getGoodsReceiptListCellDisplayTexts(columnId, row)),
        sortable: isSortableGoodsReceiptColumn(columnId),
        measure: measureHintsFromValueKind(column),
      });
    },
    [deviceClass, frozen.headerRefs, rows]
  );
  const resize = useResizableListColumns({
    columns,
    columnWidths: columnPrefs.columnWidths,
    deviceClass,
    getColumnDef: getGoodsReceiptColumnDef,
    headerRefs: frozen.headerRefs,
    resolveAutoWidth,
  });

  const handleHeaderSort = (field: string) => {
    if (!isSortableGoodsReceiptColumn(field)) return;
    const next = toggleGoodsReceiptColumnSort(field, sortField, sortDirection);
    onSortChange(next.field, next.direction);
  };

  return (
    <ListWorkspaceRegistryTableFrame scrollRef={frozen.scrollContainerRef}>
          <table className={listTableElementClass("medium")}>
            <thead>
              <tr>
                {columns.map((columnId, index) => {
                  const column = getGoodsReceiptColumnDef(columnId);
                  const active = sortField === columnId;
                  const sortable = isSortableGoodsReceiptColumn(columnId);
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
                return (
                  <tr
                    key={row.id}
                    className={listTableRowClass(selected)}
                    onClick={() => onSelect(row.id)}
                  >
                    {columns.map((columnId, index) => {
                      const column = getGoodsReceiptColumnDef(columnId);
                      const sticky = frozen.getStickyCellProps(index, "body");
                      const widthStyles = resize.resolveWidthStyles(columnId, index);
                      return (
                        <ListWorkspaceRegistryBodyCell
                          key={columnId}
                          column={column}
                          columnId={columnId}
                          className={cn(
                            sticky.className,
                            frozen.bodyCellClass(index, selected)
                          )}
                          style={mergeColumnCellStyles(sticky.style, widthStyles)}
                        >
                          {renderGoodsReceiptListCell(columnId, row)}
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
