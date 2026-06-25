"use client";

import { useCallback, useMemo } from "react";
import { renderTransferListCell } from "@/components/inventory/transfers/transfer-list-cells";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
import {
  ListWorkspaceRegistryHeaderCell,
  ListWorkspaceRegistryTableFrame,
  ListWorkspaceRegistryBodyCell,
} from "@/components/layout/list-workspace-registry-table";
import { useDeviceClass } from "@/hooks/use-device-class";
import { getOrderedVisibleColumns } from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import {
  getColumnResizeBounds,
  mergeColumnCellStyles,
} from "@/lib/list-columns/sizing";
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
import { getTransferListCellDisplayTexts } from "@/lib/inventory/transfers/list-column-display-text";
import {
  getTransferColumnDef,
  type TransferListColumnId,
} from "@/lib/inventory/transfers/list-columns";
import {
  isSortableTransferColumn,
  toggleTransferColumnSort,
  type TransferListSortDirection,
  type TransferListSortField,
} from "@/lib/inventory/transfers/list-sort";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";
import {
  MATRIX_TABLE_COLUMN_RESIZE_HANDLE_CLASS,
  listTableElementClass,
  listTableRowClass,
} from "@/lib/layout/list-table-chrome";
import type { FrozenColumnPref } from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";

type Props = {
  rows: StockTransferRow[];
  columnPrefs: ListColumnPrefs<TransferListColumnId>;
  sortField: TransferListSortField;
  sortDirection: TransferListSortDirection;
  frozenColumnCount: FrozenColumnPref;
  onSortChange: (field: TransferListSortField, direction: TransferListSortDirection) => void;
  onColumnWidthChange?: (columnId: TransferListColumnId, width: number | null) => void;
  selectedId: string | null;
  onSelect: (transferId: string) => void;
};

export function TransferListTable({
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
    (columnId: TransferListColumnId, index: number) => {
      const column = getTransferColumnDef(columnId);
      return resolveListColumnAutoWidth({
        column,
        deviceClass,
        headerElement: frozen.headerRefs.current[index],
        bodyTexts: rows.flatMap((row) => getTransferListCellDisplayTexts(columnId, row)),
        sortable: isSortableTransferColumn(columnId),
        measure: {
          ...measureHintsFromValueKind(column, {
            statusBadge: columnId === "status",
          }),
          mono: columnId === "document",
          tabular: columnId === "lines",
        },
      });
    },
    [deviceClass, frozen.headerRefs, rows]
  );
  const resize = useResizableListColumns({
    columns,
    columnWidths: columnPrefs.columnWidths,
    deviceClass,
    getColumnDef: getTransferColumnDef,
    headerRefs: frozen.headerRefs,
    resolveAutoWidth,
  });

  const handleHeaderSort = (field: string) => {
    if (!isSortableTransferColumn(field)) return;
    const next = toggleTransferColumnSort(field, sortField, sortDirection);
    onSortChange(next.field, next.direction);
  };

  return (
    <ListWorkspaceRegistryTableFrame scrollRef={frozen.scrollContainerRef}>
          <table className={listTableElementClass("wide")}>
            <thead>
              <tr>
              {columns.map((columnId, index) => {
                const column = getTransferColumnDef(columnId);
                const active = sortField === columnId;
                const sortable = isSortableTransferColumn(columnId);
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
            {rows.map((row) => {
              const selected = selectedId === row.id;
              return (
                <tr
                  key={row.id}
                  className={listTableRowClass(selected)}
                  onClick={() => onSelect(row.id)}
                >
                  {columns.map((columnId, index) => {
                    const column = getTransferColumnDef(columnId);
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
                        {renderTransferListCell(columnId, row, {
                          chipDisplay: columnPrefs.columnChipDisplay,
                        })}
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
