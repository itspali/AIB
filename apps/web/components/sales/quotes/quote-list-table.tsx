"use client";

import { useCallback, useMemo, useRef } from "react";
import { renderSalesQuoteListCell } from "@/components/sales/quotes/quote-list-cells";
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
import { getSalesQuoteListCellDisplayTexts } from "@/lib/sales/quotes/list-column-display-text";
import {
  getSalesQuoteColumnDef,
  type SalesQuoteListColumnId,
} from "@/lib/sales/quotes/list-columns";
import {
  isSortableSalesQuoteColumn,
  toggleSalesQuoteColumnSort,
  type SalesQuoteListSortDirection,
  type SalesQuoteListSortField,
} from "@/lib/sales/quotes/list-sort";
import type { SalesQuoteRow } from "@/lib/sales/quotes/types";
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
  rows: SalesQuoteRow[];
  columnPrefs: ListColumnPrefs<SalesQuoteListColumnId>;
  sortField: SalesQuoteListSortField;
  sortDirection: SalesQuoteListSortDirection;
  frozenColumnCount: FrozenColumnPref;
  onSortChange: (field: SalesQuoteListSortField, direction: SalesQuoteListSortDirection) => void;
  onColumnWidthChange?: (columnId: SalesQuoteListColumnId, width: number | null) => void;
  selectedId: string | null;
  onSelect: (quoteId: string) => void;
  bulkSelectionEnabled?: boolean;
  bulkSelectedIds?: Set<string>;
  pageAllSelected?: boolean;
  pageSomeSelected?: boolean;
  isRowBulkSelectable?: (row: SalesQuoteRow) => boolean;
  onBulkRowToggle?: (quoteId: string, checked: boolean) => void;
  onBulkPageToggle?: (checked: boolean) => void;
};

export function QuoteListTable({
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
    (columnId: SalesQuoteListColumnId, index: number) => {
      const column = getSalesQuoteColumnDef(columnId);
      return resolveListColumnAutoWidth({
        column,
        deviceClass,
        headerElement: frozen.headerRefs.current[index],
        bodyTexts: rows.flatMap((row) => getSalesQuoteListCellDisplayTexts(columnId, row)),
        sortable: isSortableSalesQuoteColumn(columnId),
        measure: measureHintsFromValueKind(column),
      });
    },
    [deviceClass, frozen.headerRefs, rows]
  );
  const resize = useResizableListColumns({
    columns,
    columnWidths: columnPrefs.columnWidths,
    deviceClass,
    getColumnDef: getSalesQuoteColumnDef,
    headerRefs: frozen.headerRefs,
    resolveAutoWidth,
  });

  const handleHeaderSort = (field: string) => {
    if (!isSortableSalesQuoteColumn(field)) return;
    const next = toggleSalesQuoteColumnSort(field, sortField, sortDirection);
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
          <table className={listTableElementClass("medium")}>
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
                      aria-label="Select all approvable quotes on this page"
                    />
                  </ListWorkspaceRegistrySelectHeaderCell>
                ) : null}
                {columns.map((columnId, index) => {
                  const column = getSalesQuoteColumnDef(columnId);
                  const active = sortField === columnId;
                  const sortable = isSortableSalesQuoteColumn(columnId);
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
                            onCommit={(width) => onColumnWidthChange(columnId, width)}
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
                    className={listTableRowClass(selected, true)}
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
                          aria-label={`Select ${row.quotation_number}`}
                        />
                      </ListWorkspaceRegistrySelectBodyCell>
                    ) : null}
                    {columns.map((columnId, index) => {
                      const column = getSalesQuoteColumnDef(columnId);
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
                          {renderSalesQuoteListCell(columnId, row)}
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
