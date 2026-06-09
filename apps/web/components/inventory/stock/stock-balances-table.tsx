"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
import { mergeColumnCellStyles, getColumnResizeBounds } from "@/lib/list-columns/sizing";
import {
  measureHintsFromValueKind,
  resolveListColumnAutoWidth,
} from "@/lib/list-columns/resolve-column-auto-width";
import { useResizableListColumns } from "@/lib/list-columns/use-resizable-list-columns";
import { useDeviceClass } from "@/hooks/use-device-class";
import { getOrderedVisibleColumns } from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import {
  isAutoFrozenColumnPref,
  LIST_TABLE_HEADER_Z,
  resolveListFrozenColumnCount,
  useFrozenListColumns,
} from "@/lib/list-columns/use-frozen-list-columns";
import {
  getStockBalanceCellDisplayTexts,
} from "@/lib/inventory/stock/list-column-display-text";
import {
  getStockBalanceColumnDef,
  type StockBalanceColumnId,
} from "@/lib/inventory/stock/list-columns";
import {
  isSortableStockBalanceColumn,
  toggleStockColumnSort,
  type StockBalanceSortField,
  type StockListSortDirection,
} from "@/lib/inventory/stock/list-sort";
import type { StockBalanceRow } from "@/lib/inventory/stock/types";
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
  listTableRowClass,
} from "@/lib/layout/list-table-chrome";
import type { FrozenColumnPref } from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";

type Props = {
  rows: StockBalanceRow[];
  columnPrefs: ListColumnPrefs<StockBalanceColumnId>;
  sortField: StockBalanceSortField;
  sortDirection: StockListSortDirection;
  frozenColumnCount: FrozenColumnPref;
  onSortChange: (field: StockBalanceSortField, direction: StockListSortDirection) => void;
  onColumnWidthChange?: (columnId: StockBalanceColumnId, width: number | null) => void;
  selectedId: string | null;
  onAdjust?: (row: StockBalanceRow) => void;
};

function renderBalanceCell(columnId: StockBalanceColumnId, row: StockBalanceRow) {
  switch (columnId) {
    case "location":
      return (
        <>
          <div className="font-medium">{row.location_name}</div>
          {row.location_code ? (
            <div className="text-xs text-muted-foreground">{row.location_code}</div>
          ) : null}
        </>
      );
    case "item":
      return (
        <>
          <div className="font-medium">{row.item_name}</div>
          {row.variant_sku ? (
            <div className="font-mono text-xs text-muted-foreground">{row.variant_sku}</div>
          ) : null}
        </>
      );
    case "sku":
      return <span className="font-mono text-xs">{row.variant_sku}</span>;
    case "on_hand":
      return (
        <div className="inline-flex items-center justify-end gap-2">
          <span className="font-medium tabular-nums">{row.total_quantity_on_hand}</span>
          {row.below_reorder ? (
            <Badge variant="action_required" className="text-[10px]">
              Low
            </Badge>
          ) : null}
        </div>
      );
    case "avg_cost":
      return <span className="tabular-nums">{row.current_average_cost}</span>;
    case "reorder":
      return (
        <span className="tabular-nums text-muted-foreground">{row.reorder_point ?? "—"}</span>
      );
    default:
      return null;
  }
}

export function StockBalancesTable({
  rows,
  columnPrefs,
  sortField,
  sortDirection,
  frozenColumnCount,
  onSortChange,
  onColumnWidthChange,
  selectedId,
  onAdjust,
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
    (columnId: StockBalanceColumnId, index: number) => {
      const column = getStockBalanceColumnDef(columnId);
      return resolveListColumnAutoWidth({
        column,
        deviceClass,
        headerElement: frozen.headerRefs.current[index],
        bodyTexts: rows.flatMap((row) => getStockBalanceCellDisplayTexts(columnId, row)),
        sortable: isSortableStockBalanceColumn(columnId),
        measure: {
          ...measureHintsFromValueKind(column),
          mono: columnId === "sku",
          tabular: columnId === "on_hand" || columnId === "avg_cost" || columnId === "reorder",
          statusBadgeExtraPx: columnId === "on_hand" ? 20 : 0,
        },
      });
    },
    [deviceClass, frozen.headerRefs, rows]
  );
  const resize = useResizableListColumns({
    columns,
    columnWidths: columnPrefs.columnWidths,
    deviceClass,
    getColumnDef: getStockBalanceColumnDef,
    headerRefs: frozen.headerRefs,
    resolveAutoWidth,
  });

  const handleHeaderSort = (field: string) => {
    if (!isSortableStockBalanceColumn(field)) return;
    const next = toggleStockColumnSort(field, sortField, sortDirection);
    onSortChange(next.field, next.direction);
  };

  return (
    <div className={LIST_TABLE_ROOT}>
      <div className={LIST_TABLE_SURFACE}>
        <div ref={frozen.scrollContainerRef} className={LIST_TABLE_SCROLL}>
          <table className={listTableElementClass("narrow")}>
            <thead>
              <tr className="text-left">
              {columns.map((columnId, index) => {
                const column = getStockBalanceColumnDef(columnId);
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
                      listTableHeaderCornerClass(index, columns.length - 1)
                    )}
                    style={mergeColumnCellStyles(
                      sticky.style,
                      widthStyles,
                      !isFrozen ? { zIndex: LIST_TABLE_HEADER_Z + (columns.length - index) } : {}
                    )}
                    aria-sort={active ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
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
              {onAdjust ? (
                <th
                  className={cn(
                    LIST_TABLE_HEADER_CELL,
                    "sticky top-0 bg-muted text-right"
                  )}
                  scope="col"
                >
                  Actions
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = selectedId === row.id;
              return (
                <tr key={row.id} className={listTableRowClass(selected, false)}>
                  {columns.map((columnId, index) => {
                    const column = getStockBalanceColumnDef(columnId);
                    const sticky = frozen.getStickyCellProps(index, "body");
                    const widthStyles = resize.resolveWidthStyles(columnId, index);
                    return (
                      <td
                        key={columnId}
                        className={cn(
                          LIST_TABLE_BODY_CELL,
                          sticky.className,
                          frozen.bodyCellClass(index, selected),
                          column.align === "right" && "text-right tabular-nums"
                        )}
                        style={mergeColumnCellStyles(sticky.style, widthStyles)}
                      >
                        {renderBalanceCell(columnId, row)}
                      </td>
                    );
                  })}
                  {onAdjust ? (
                    <td className={cn(LIST_TABLE_BODY_CELL, "text-right", listTableBodyCellInteractionClass(selected))}>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 opacity-80 transition-opacity group-hover:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          onAdjust(row);
                        }}
                      >
                        Adjust
                      </Button>
                    </td>
                  ) : null}
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
