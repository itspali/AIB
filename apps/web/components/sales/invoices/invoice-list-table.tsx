"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback, useMemo } from "react";
import { renderSalesInvoiceListCell } from "@/components/sales/invoices/invoice-list-cells";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
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
import { getSalesInvoiceListCellDisplayTexts } from "@/lib/sales/invoices/list-column-display-text";
import {
  getSalesInvoiceColumnDef,
  type SalesInvoiceListColumnId,
} from "@/lib/sales/invoices/list-columns";
import {
  isSortableSalesInvoiceColumn,
  toggleSalesInvoiceColumnSort,
  type SalesInvoiceListSortDirection,
  type SalesInvoiceListSortField,
} from "@/lib/sales/invoices/list-sort";
import type { SalesInvoiceRow } from "@/lib/sales/invoices/types";
import {
  LIST_TABLE_BODY_CELL,
  LIST_TABLE_HEADER_CELL,
  LIST_TABLE_HEADER_SORTABLE,
  LIST_TABLE_ROOT,
  LIST_TABLE_SCROLL,
  LIST_TABLE_SURFACE,
  listTableElementClass,
  listTableHeaderCornerClass,
  listTableRowClass,
} from "@/lib/layout/list-table-chrome";
import type { FrozenColumnPref } from "@/lib/products/list-prefs";
import { cn } from "@/lib/utils";

type Props = {
  rows: SalesInvoiceRow[];
  columnPrefs: ListColumnPrefs<SalesInvoiceListColumnId>;
  sortField: SalesInvoiceListSortField;
  sortDirection: SalesInvoiceListSortDirection;
  frozenColumnCount: FrozenColumnPref;
  onSortChange: (field: SalesInvoiceListSortField, direction: SalesInvoiceListSortDirection) => void;
  onColumnWidthChange?: (columnId: SalesInvoiceListColumnId, width: number | null) => void;
  selectedId: string | null;
  onSelect: (invoiceId: string) => void;
};

export function InvoiceListTable(props: Props) {
  const {
    rows,
    columnPrefs,
    sortField,
    sortDirection,
    frozenColumnCount,
    onSortChange,
    onColumnWidthChange,
    selectedId,
    onSelect,
  } = props;
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
    (columnId: SalesInvoiceListColumnId, index: number) => {
      const column = getSalesInvoiceColumnDef(columnId);
      return resolveListColumnAutoWidth({
        column,
        deviceClass,
        headerElement: frozen.headerRefs.current[index],
        bodyTexts: rows.flatMap((row) => getSalesInvoiceListCellDisplayTexts(columnId, row)),
        sortable: isSortableSalesInvoiceColumn(columnId),
        measure: measureHintsFromValueKind(column),
      });
    },
    [deviceClass, frozen.headerRefs, rows]
  );
  const resize = useResizableListColumns({
    columns,
    columnWidths: columnPrefs.columnWidths,
    deviceClass,
    getColumnDef: getSalesInvoiceColumnDef,
    headerRefs: frozen.headerRefs,
    resolveAutoWidth,
  });

  const handleHeaderSort = (field: string) => {
    if (!isSortableSalesInvoiceColumn(field)) return;
    const next = toggleSalesInvoiceColumnSort(field, sortField, sortDirection);
    onSortChange(next.field, next.direction);
  };

  return (
    <div className={LIST_TABLE_ROOT}>
      <div className={LIST_TABLE_SURFACE}>
        <div ref={frozen.scrollContainerRef} className={LIST_TABLE_SCROLL}>
          <table className={listTableElementClass("medium")}>
            <thead>
              <tr className="text-left">
                {columns.map((columnId, index) => {
                  const column = getSalesInvoiceColumnDef(columnId);
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
                          onCommit={(width) => onColumnWidthChange(columnId, width)}
                        />
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={listTableRowClass(selectedId === row.id, true)}
                  onClick={() => onSelect(row.id)}
                >
                  {columns.map((columnId, index) => {
                    const column = getSalesInvoiceColumnDef(columnId);
                    const sticky = frozen.getStickyCellProps(index, "body");
                    const widthStyles = resize.resolveWidthStyles(columnId, index);

                    return (
                      <td
                        key={columnId}
                        className={cn(
                          LIST_TABLE_BODY_CELL,
                          sticky.className,
                          frozen.bodyCellClass(index, selectedId === row.id),
                          column.align === "right" && "text-right"
                        )}
                        style={mergeColumnCellStyles(sticky.style, widthStyles)}
                      >
                        {renderSalesInvoiceListCell(columnId, row)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
