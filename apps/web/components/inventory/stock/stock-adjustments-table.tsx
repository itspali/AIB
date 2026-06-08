"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useMemo } from "react";
import { renderStockAdjustmentListCell } from "@/components/inventory/stock/stock-adjustment-list-cells";
import { useDeviceClass } from "@/hooks/use-device-class";
import { getOrderedVisibleColumns } from "@/lib/list-columns/prefs";
import type { ListColumnPrefs } from "@/lib/list-columns/types";
import {
  resolveListFrozenColumnCount,
  useFrozenListColumns,
} from "@/lib/list-columns/use-frozen-list-columns";
import {
  getStockAdjustmentColumnDef,
  type StockAdjustmentColumnId,
} from "@/lib/inventory/stock/list-columns";
import {
  isSortableStockAdjustmentColumn,
  toggleStockColumnSort,
  type StockAdjustmentSortField,
  type StockListSortDirection,
} from "@/lib/inventory/stock/list-sort";
import type { StockAdjustmentRow } from "@/lib/inventory/stock/types";
import {
  LIST_TABLE_BODY_CELL,
  LIST_TABLE_HEADER_CELL,
  LIST_TABLE_HEADER_SORTABLE,
  listTableRowClass,
} from "@/lib/layout/list-table-chrome";
import type { FrozenColumnPref } from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";

type Props = {
  rows: StockAdjustmentRow[];
  columnPrefs: ListColumnPrefs<StockAdjustmentColumnId>;
  sortField: StockAdjustmentSortField;
  sortDirection: StockListSortDirection;
  frozenColumnCount: FrozenColumnPref;
  onSortChange: (field: StockAdjustmentSortField, direction: StockListSortDirection) => void;
  selectedId: string | null;
  onSelect: (adjustmentId: string) => void;
};

export function StockAdjustmentsTable({
  rows,
  columnPrefs,
  sortField,
  sortDirection,
  frozenColumnCount,
  onSortChange,
  selectedId,
  onSelect,
}: Props) {
  const { deviceClass } = useDeviceClass();
  const columns = useMemo(() => getOrderedVisibleColumns(columnPrefs), [columnPrefs]);
  const resolvedFrozenCount = resolveListFrozenColumnCount(frozenColumnCount, deviceClass);
  const frozen = useFrozenListColumns({
    columnCount: columns.length,
    frozenColumnCount: resolvedFrozenCount,
  });

  const handleHeaderSort = (field: string) => {
    if (!isSortableStockAdjustmentColumn(field)) return;
    const next = toggleStockColumnSort(field, sortField, sortDirection);
    onSortChange(next.field, next.direction);
  };

  return (
    <div className="surface-inset h-full min-h-0 overflow-hidden">
      <div
        ref={frozen.scrollContainerRef}
        className="h-full min-h-0 overflow-x-auto overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
      >
        <table className="w-full min-w-[760px] border-separate border-spacing-0 text-left text-sm">
          <thead>
            <tr>
              {columns.map((columnId, index) => {
                const column = getStockAdjustmentColumnDef(columnId);
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
                    const column = getStockAdjustmentColumnDef(columnId);
                    const sticky = frozen.getStickyCellProps(index, "body");
                    return (
                      <td
                        key={columnId}
                        className={cn(
                          LIST_TABLE_BODY_CELL,
                          sticky.className,
                          frozen.bodyCellClass(index, selected),
                          column.align === "right" && "text-right tabular-nums",
                          columnId === "posted" && "text-sm text-muted-foreground"
                        )}
                        style={sticky.style}
                      >
                        {renderStockAdjustmentListCell(columnId, row, {
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
      </div>
    </div>
  );
}
