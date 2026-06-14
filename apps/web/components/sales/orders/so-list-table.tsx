"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { renderSalesOrderListCell } from "@/components/sales/orders/so-list-cells";
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
  LIST_SELECTION_COLUMN_Z_BODY,
  LIST_SELECTION_COLUMN_Z_HEADER,
  LIST_TABLE_HEADER_Z,
  resolveListFrozenColumnCount,
  useFrozenListColumns,
} from "@/lib/list-columns/use-frozen-list-columns";
import { getSalesOrderListCellDisplayTexts } from "@/lib/sales/orders/list-column-display-text";
import {
  getSalesOrderColumnDef,
  type SalesOrderListColumnId,
} from "@/lib/sales/orders/list-columns";
import {
  isSortableSalesOrderColumn,
  toggleSalesOrderColumnSort,
  type SalesOrderListSortDirection,
  type SalesOrderListSortField,
} from "@/lib/sales/orders/list-sort";
import type { SalesOrderRow } from "@/lib/sales/orders/types";
import {
  LIST_TABLE_BODY_CELL,
  LIST_TABLE_CHECKBOX_CLASS,
  LIST_TABLE_FROZEN_EDGE_SHADOW,
  LIST_TABLE_HEADER_CELL,
  LIST_TABLE_HEADER_CELL_BG,
  LIST_TABLE_HEADER_SORTABLE,
  LIST_TABLE_ROOT,
  LIST_TABLE_SCROLL,
  LIST_TABLE_SURFACE,
  listTableElementClass,
  listTableHeaderCornerClass,
  listTableLeadingCellInteractionClass,
  listTableRowClass,
} from "@/lib/layout/list-table-chrome";
import type { FrozenColumnPref } from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";

type Props = {
  rows: SalesOrderRow[];
  columnPrefs: ListColumnPrefs<SalesOrderListColumnId>;
  sortField: SalesOrderListSortField;
  sortDirection: SalesOrderListSortDirection;
  frozenColumnCount: FrozenColumnPref;
  onSortChange: (field: SalesOrderListSortField, direction: SalesOrderListSortDirection) => void;
  onColumnWidthChange?: (columnId: SalesOrderListColumnId, width: number | null) => void;
  selectedId: string | null;
  onSelect: (salesOrderId: string) => void;
  bulkSelectionEnabled?: boolean;
  bulkSelectedIds?: Set<string>;
  pageAllSelected?: boolean;
  pageSomeSelected?: boolean;
  isRowBulkSelectable?: (row: SalesOrderRow) => boolean;
  onBulkRowToggle?: (salesOrderId: string, checked: boolean) => void;
  onBulkPageToggle?: (checked: boolean) => void;
};

export function SoListTable({
  rows,
  columnPrefs,
  sortField,
  sortDirection,
  frozenColumnCount,
  onSortChange,
  onColumnWidthChange,
  selectedId,
  onSelect,
  bulkSelectionEnabled = false,
  bulkSelectedIds = new Set<string>(),
  pageAllSelected = false,
  pageSomeSelected = false,
  isRowBulkSelectable = () => false,
  onBulkRowToggle,
  onBulkPageToggle,
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
    leadingColumnRef: bulkSelectionEnabled ? selectionColumnRef : undefined,
    remeasureKey: `${rows.length}:${widthRemeasureKey}`,
  });
  const resolveAutoWidth = useCallback(
    (columnId: SalesOrderListColumnId, index: number) => {
      const column = getSalesOrderColumnDef(columnId);
      return resolveListColumnAutoWidth({
        column,
        deviceClass,
        headerElement: frozen.headerRefs.current[index],
        bodyTexts: rows.flatMap((row) => getSalesOrderListCellDisplayTexts(columnId, row)),
        sortable: isSortableSalesOrderColumn(columnId),
        measure: measureHintsFromValueKind(column, {
          statusBadge: columnId === "status",
        }),
      });
    },
    [deviceClass, frozen.headerRefs, rows]
  );
  const resize = useResizableListColumns({
    columns,
    columnWidths: columnPrefs.columnWidths,
    deviceClass,
    getColumnDef: getSalesOrderColumnDef,
    headerRefs: frozen.headerRefs,
    resolveAutoWidth,
  });

  const handleHeaderSort = (field: string) => {
    if (!isSortableSalesOrderColumn(field)) return;
    const next = toggleSalesOrderColumnSort(field, sortField, sortDirection);
    onSortChange(next.field, next.direction);
  };

  const selectionColumnShowsEdge =
    bulkSelectionEnabled && frozen.hasHorizontalScroll && frozen.effectiveFrozenCount === 0;

  const selectionHeaderClass = cn(
    "w-10 p-0 font-medium text-muted-foreground",
    LIST_TABLE_HEADER_CELL_BG,
    selectionColumnShowsEdge && LIST_TABLE_FROZEN_EDGE_SHADOW
  );

  const selectionBodyClass = (selected: boolean) =>
    cn(
      "w-10 p-0 text-center",
      selectionColumnShowsEdge && LIST_TABLE_FROZEN_EDGE_SHADOW,
      listTableLeadingCellInteractionClass(selected)
    );

  return (
    <div className={LIST_TABLE_ROOT}>
      <div className={LIST_TABLE_SURFACE}>
        <div ref={frozen.scrollContainerRef} className={LIST_TABLE_SCROLL}>
          <table className={listTableElementClass("wide")}>
            <thead>
              <tr className="text-left">
                {bulkSelectionEnabled ? (
                  <th
                    ref={selectionColumnRef}
                    className={cn(
                      "sticky left-0 top-0 isolate overflow-hidden rounded-tl-lg",
                      selectionHeaderClass
                    )}
                    style={{ zIndex: LIST_SELECTION_COLUMN_Z_HEADER }}
                  >
                    <div className="flex items-center justify-center p-2.5">
                      <Checkbox
                        className={LIST_TABLE_CHECKBOX_CLASS}
                        checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false}
                        onCheckedChange={(checked) => onBulkPageToggle?.(checked === true)}
                        aria-label="Select all approvable sales orders on this page"
                      />
                    </div>
                  </th>
                ) : null}
                {columns.map((columnId, index) => {
                  const column = getSalesOrderColumnDef(columnId);
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
                        listTableHeaderCornerClass(
                          bulkSelectionEnabled ? index + 1 : index,
                          bulkSelectionEnabled ? columns.length : columns.length - 1
                        )
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
                const bulkSelected = bulkSelectedIds.has(row.id);
                const bulkSelectable = isRowBulkSelectable(row);

                return (
                  <tr
                    key={row.id}
                    className={listTableRowClass(selected)}
                    onClick={() => onSelect(row.id)}
                  >
                    {bulkSelectionEnabled ? (
                      <td
                        className={cn(
                          "sticky left-0 isolate",
                          LIST_TABLE_BODY_CELL,
                          selectionBodyClass(selected)
                        )}
                        style={{ zIndex: LIST_SELECTION_COLUMN_Z_BODY }}
                      >
                        {bulkSelectable ? (
                          <div
                            className="flex items-center justify-center p-2.5"
                            onClick={(event) => event.stopPropagation()}
                            onKeyDown={(event) => event.stopPropagation()}
                          >
                            <Checkbox
                              className={LIST_TABLE_CHECKBOX_CLASS}
                              checked={bulkSelected}
                              onCheckedChange={(checked) =>
                                onBulkRowToggle?.(row.id, checked === true)
                              }
                              aria-label={`Select ${row.voucher_number}`}
                            />
                          </div>
                        ) : null}
                      </td>
                    ) : null}
                    {columns.map((columnId, index) => {
                      const column = getSalesOrderColumnDef(columnId);
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
                          {renderSalesOrderListCell(columnId, row, {
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
    </div>
  );
}
