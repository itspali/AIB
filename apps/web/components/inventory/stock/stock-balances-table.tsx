"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeviceClass } from "@/hooks/use-device-class";
import { getOrderedVisibleColumns } from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import {
  resolveListFrozenColumnCount,
  useFrozenListColumns,
} from "@/lib/list-columns/use-frozen-list-columns";
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
  LIST_TABLE_HEADER_ROW,
  LIST_TABLE_HEADER_SORTABLE,
  LIST_TABLE_SURFACE,
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
          {row.base_unit_of_measure ? (
            <div className="text-xs text-muted-foreground">{row.base_unit_of_measure}</div>
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
  selectedId,
  onAdjust,
}: Props) {
  const { deviceClass } = useDeviceClass();
  const columns = useMemo(() => getOrderedVisibleColumns(columnPrefs), [columnPrefs]);
  const resolvedFrozenCount = resolveListFrozenColumnCount(frozenColumnCount, deviceClass);
  const frozen = useFrozenListColumns({
    columnCount: columns.length,
    frozenColumnCount: resolvedFrozenCount,
  });

  const handleHeaderSort = (field: string) => {
    if (!isSortableStockBalanceColumn(field)) return;
    const next = toggleStockColumnSort(field, sortField, sortDirection);
    onSortChange(next.field, next.direction);
  };

  return (
    <div className={LIST_TABLE_SURFACE}>
      <div
        ref={frozen.scrollContainerRef}
        className="h-full min-h-0 overflow-x-auto overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
      >
        <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
          <thead className={LIST_TABLE_HEADER_ROW}>
            <tr className="bg-muted text-left">
              {columns.map((columnId, index) => {
                const column = getStockBalanceColumnDef(columnId);
                const active = sortField === columnId;
                const sticky = frozen.getStickyCellProps(index, "header");
                return (
                  <th
                    key={columnId}
                    ref={(element) => {
                      frozen.headerRefs.current[index] = element;
                    }}
                    scope="col"
                    className={cn(
                      LIST_TABLE_HEADER_CELL,
                      LIST_TABLE_HEADER_SORTABLE,
                      sticky.className,
                      frozen.headerCellClass(index),
                      column.align === "right" && "text-right",
                      active && "text-foreground"
                    )}
                    style={sticky.style}
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
                    return (
                      <td
                        key={columnId}
                        className={cn(
                          LIST_TABLE_BODY_CELL,
                          sticky.className,
                          frozen.bodyCellClass(index, selected),
                          column.align === "right" && "text-right tabular-nums"
                        )}
                        style={sticky.style}
                      >
                        {renderBalanceCell(columnId, row)}
                      </td>
                    );
                  })}
                  {onAdjust ? (
                    <td className={cn(LIST_TABLE_BODY_CELL, "text-right")}>
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
  );
}
