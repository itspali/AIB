"use client";

import { useCallback, useMemo } from "react";
import { renderUomListCell } from "@/components/inventory/uom/uom-list-cells";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
import {
  ListWorkspaceRegistryHeaderCell,
  ListWorkspaceRegistryTableFrame,
} from "@/components/layout/list-workspace-registry-table";
import { useDeviceClass } from "@/hooks/use-device-class";
import { getOrderedVisibleColumns } from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import { mergeColumnCellStyles, getColumnResizeBounds } from "@/lib/list-columns/sizing";
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
import { getUomCellDisplayTexts } from "@/lib/uom/list-column-display-text";
import { getUomColumnDef, type UomListColumnId } from "@/lib/uom/list-columns";
import {
  isSortableUomColumn,
  toggleUomColumnSort,
  type UomListSortDirection,
  type UomListSortField,
} from "@/lib/uom/list-sort";
import type { UomRow } from "@/lib/uom/types";
import {
  MATRIX_TABLE_COLUMN_RESIZE_HANDLE_CLASS,
  listTableBodyCellInteractionClass,
  listTableElementClass,
  listTableRowClass,
} from "@/lib/layout/list-table-chrome";
import type { FrozenColumnPref } from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";

type Props = {
  rows: UomRow[];
  columnPrefs: ListColumnPrefs<UomListColumnId>;
  sortField: UomListSortField;
  sortDirection: UomListSortDirection;
  frozenColumnCount: FrozenColumnPref;
  onSortChange: (field: UomListSortField, direction: UomListSortDirection) => void;
  onColumnWidthChange?: (columnId: UomListColumnId, width: number | null) => void;
  selectedId: string | null;
  onSelect: (row: UomRow) => void;
};

export function UomListTable({
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
    (columnId: UomListColumnId, index: number) => {
      const column = getUomColumnDef(columnId);
      return resolveListColumnAutoWidth({
        column,
        deviceClass,
        headerElement: frozen.headerRefs.current[index],
        bodyTexts: rows.flatMap((row) => getUomCellDisplayTexts(columnId, row)),
        sortable: isSortableUomColumn(columnId),
        measure: {
          ...measureHintsFromValueKind(column),
          mono: columnId === "code",
          tabular: columnId === "factor_to_base",
        },
      });
    },
    [deviceClass, frozen.headerRefs, rows]
  );
  const resize = useResizableListColumns({
    columns,
    columnWidths: columnPrefs.columnWidths,
    deviceClass,
    getColumnDef: getUomColumnDef,
    headerRefs: frozen.headerRefs,
    resolveAutoWidth,
  });

  const handleHeaderSort = (field: string) => {
    if (!isSortableUomColumn(field)) return;
    const next = toggleUomColumnSort(field, sortField, sortDirection);
    onSortChange(next.field, next.direction);
  };

  return (
    <ListWorkspaceRegistryTableFrame scrollRef={frozen.scrollContainerRef}>
      <table className={listTableElementClass("wide")}>
        <thead>
          <tr>
            {columns.map((columnId, index) => {
              const column = getUomColumnDef(columnId);
              const active = sortField === columnId;
              const sortable = isSortableUomColumn(columnId);
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
                  align={
                    column.align === "right"
                      ? "right"
                      : column.align === "center"
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
                className={listTableRowClass(selected, true, false, "classic")}
                onClick={() => onSelect(row)}
              >
                {columns.map((columnId, index) => {
                  const column = getUomColumnDef(columnId);
                  const sticky = frozen.getStickyCellProps(index, "body");
                  const widthStyles = resize.resolveWidthStyles(columnId, index);
                  return (
                    <td
                      key={columnId}
                      className={cn(
                        sticky.className,
                        frozen.bodyCellClass(index, selected),
                        column.align === "right" && "text-right tabular-nums",
                        column.align === "center" && "text-center",
                        listTableBodyCellInteractionClass(selected, { surface: "classic" })
                      )}
                      style={mergeColumnCellStyles(sticky.style, widthStyles)}
                    >
                      {renderUomListCell(columnId, row, {
                        chipDisplay: columnPrefs.columnChipDisplay,
                      })}
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
