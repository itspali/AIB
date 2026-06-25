"use client";

import { useCallback, useMemo, useRef } from "react";
import { renderSalesOrderListCell } from "@/components/sales/orders/so-list-cells";
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
  LIST_TABLE_FROZEN_EDGE_SHADOW,
  LIST_WORKSPACE_BULK_CHECKBOX_CLASS,
  MATRIX_TABLE_COLUMN_RESIZE_HANDLE_CLASS,
  listTableElementClass,
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

  const selectionHeaderClass = cn(selectionColumnShowsEdge && LIST_TABLE_FROZEN_EDGE_SHADOW);

  const selectionBodyEdgeClass = cn(
    selectionColumnShowsEdge && LIST_TABLE_FROZEN_EDGE_SHADOW
  );

  return (
    <ListWorkspaceRegistryTableFrame scrollRef={frozen.scrollContainerRef}>
          <table className={listTableElementClass("wide")}>
            <thead>
              <tr>
                {bulkSelectionEnabled ? (
                  <ListWorkspaceRegistrySelectHeaderCell
                    cellRef={selectionColumnRef}
                    className={selectionHeaderClass}
                    style={{ zIndex: LIST_SELECTION_COLUMN_Z_HEADER }}
                  >
                    <Checkbox
                      className={LIST_WORKSPACE_BULK_CHECKBOX_CLASS}
                      checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => onBulkPageToggle?.(checked === true)}
                      aria-label="Select all approvable sales orders on this page"
                    />
                  </ListWorkspaceRegistrySelectHeaderCell>
                ) : null}
                {columns.map((columnId, index) => {
                  const column = getSalesOrderColumnDef(columnId);
                  const active = sortField === columnId;
                  const sortable = isSortableSalesOrderColumn(columnId);
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
                const bulkSelected = bulkSelectedIds.has(row.id);
                const bulkSelectable = isRowBulkSelectable(row);

                return (
                  <tr
                    key={row.id}
                    className={listTableRowClass(selected)}
                    onClick={() => onSelect(row.id)}
                  >
                    {bulkSelectionEnabled ? (
                      <ListWorkspaceRegistrySelectBodyCell
                        className={selectionBodyEdgeClass}
                        style={{ zIndex: LIST_SELECTION_COLUMN_Z_BODY }}
                      >
                        <Checkbox
                          className={LIST_WORKSPACE_BULK_CHECKBOX_CLASS}
                          checked={bulkSelectable ? bulkSelected : false}
                          disabled={!bulkSelectable}
                          onCheckedChange={(checked) =>
                            onBulkRowToggle?.(row.id, checked === true)
                          }
                          aria-label={`Select ${row.voucher_number}`}
                        />
                      </ListWorkspaceRegistrySelectBodyCell>
                    ) : null}
                    {columns.map((columnId, index) => {
                      const column = getSalesOrderColumnDef(columnId);
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
                          {renderSalesOrderListCell(columnId, row, {
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
