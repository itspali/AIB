"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback, useMemo } from "react";
import { renderQcInspectionListCell } from "@/components/procurement/quality-inspection/qc-inspection-list-cells";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
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
  LIST_TABLE_BODY_CELL,
  LIST_TABLE_HEADER_CELL,
  LIST_TABLE_HEADER_SORTABLE,
  LIST_TABLE_ROOT,
  LIST_TABLE_SCROLL,
  LIST_TABLE_SURFACE,
  listTableBodyCellInteractionClass,
  listTableElementClass,
  listTableHeaderCornerClass,
  listTableLeadingCellInteractionClass,
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

  return (
    <div className={LIST_TABLE_ROOT}>
      <div className={LIST_TABLE_SURFACE}>
        <div ref={frozen.scrollContainerRef} className={LIST_TABLE_SCROLL}>
          <table className={listTableElementClass("medium")}>
            <thead>
              <tr className="text-left">
                <th
                  scope="col"
                  className={cn(
                    "sticky left-0 z-[3] w-10 bg-muted/40",
                    LIST_TABLE_HEADER_CELL,
                    listTableHeaderCornerClass(0, columns.length)
                  )}
                >
                  <Checkbox
                    checked={pageAllSelected}
                    aria-label="Select all lines on this page"
                    onCheckedChange={(checked) => onTogglePageSelected(checked === true)}
                  />
                </th>
                {columns.map((columnId, index) => {
                  const column = getQcQueueColumnDef(columnId);
                  const active = sortField === columnId;
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
                      scope="col"
                      className={cn(
                        "relative overflow-hidden",
                        LIST_TABLE_HEADER_CELL,
                        LIST_TABLE_HEADER_SORTABLE,
                        sticky.className,
                        frozen.headerCellClass(index),
                        column.align === "right" && "text-right",
                        active && "text-foreground",
                        listTableHeaderCornerClass(index + 1, columns.length)
                      )}
                      style={{
                        ...mergeColumnCellStyles(sticky.style, widthStyles),
                        ...(!isFrozen
                          ? { zIndex: LIST_TABLE_HEADER_Z + (columns.length - index) }
                          : {}),
                      }}
                      aria-sort={
                        active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"
                      }
                      onClick={() => handleHeaderSort(columnId)}
                    >
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          column.align === "right" && "justify-end"
                        )}
                      >
                        {column.label}
                        {active ? (
                          sortDirection === "asc" ? (
                            <ArrowUp className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                          )
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 shrink-0 opacity-40" aria-hidden />
                        )}
                      </span>
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
              {rows.map((row) => {
                const selected = selectedId === row.id;
                const bulkSelected = selectedIds.has(row.id);
                return (
                  <tr
                    key={row.id}
                    className={listTableRowClass(selected || bulkSelected)}
                    onClick={() => onSelect(row.id)}
                  >
                    <td
                      className={cn(
                        "sticky left-0 z-[2] w-10 bg-background",
                        LIST_TABLE_BODY_CELL,
                        listTableLeadingCellInteractionClass(selected || bulkSelected)
                      )}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        checked={bulkSelected}
                        aria-label={`Select ${row.variant_sku}`}
                        onCheckedChange={(checked) =>
                          onToggleSelected(row.id, checked === true)
                        }
                      />
                    </td>
                    {columns.map((columnId, index) => {
                      const column = getQcQueueColumnDef(columnId);
                      const sticky = frozen.getStickyCellProps(index, "body");
                      const widthStyles = resize.resolveWidthStyles(columnId, index);
                      return (
                        <td
                          key={columnId}
                          className={cn(
                            LIST_TABLE_BODY_CELL,
                            sticky.className,
                            frozen.bodyCellClass(index, selected || bulkSelected),
                            column.align === "right" && "text-right tabular-nums"
                          )}
                          style={mergeColumnCellStyles(sticky.style, widthStyles)}
                        >
                          {renderQcInspectionListCell(columnId, row)}
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
