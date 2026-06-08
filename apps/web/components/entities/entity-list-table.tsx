"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import { renderEntityListCell } from "@/components/entities/entity-list-cells";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
import { Checkbox } from "@/components/ui/checkbox";
import { useDeviceClass } from "@/hooks/use-device-class";
import { getEntityListCellDisplayTexts } from "@/lib/entities/list-column-display-text";
import { getEntityColumnDef, type EntityListColumnId } from "@/lib/entities/list-columns";
import type { EntityListFrozenColumnCount } from "@/lib/entities/list-prefs";
import {
  isSortableEntityColumn,
  toggleEntityColumnSort,
  type EntityListSortDirection,
  type EntityListSortField,
} from "@/lib/entities/list-sort";
import type { EntityListRow } from "@/lib/entities/types";
import {
  LIST_TABLE_BODY_CELL,
  LIST_TABLE_CHECKBOX_CLASS,
  LIST_TABLE_HEADER_CELL,
  LIST_TABLE_HEADER_CELL_BG,
  LIST_TABLE_HEADER_SORTABLE,
  LIST_TABLE_ROOT,
  LIST_TABLE_SCROLL,
  LIST_TABLE_SURFACE,
  listTableElementClass,
  listTableLeadingCellInteractionClass,
  listTableRowClass,
} from "@/lib/layout/list-table-chrome";
import {
  LIST_SELECTION_COLUMN_Z_BODY,
  LIST_SELECTION_COLUMN_Z_HEADER,
  LIST_TABLE_HEADER_Z,
  resolveListFrozenColumnCount,
  useFrozenListColumns,
} from "@/lib/list-columns/use-frozen-list-columns";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  getColumnResizeBounds,
  mergeColumnCellStyles,
} from "@/lib/list-columns/sizing";
import {
  measureHintsFromValueKind,
  resolveListColumnAutoWidth,
} from "@/lib/list-columns/resolve-column-auto-width";
import { useResizableListColumns } from "@/lib/list-columns/use-resizable-list-columns";
import { cn } from "@/lib/utils";

type Props = {
  rows: EntityListRow[];
  columns: EntityListColumnId[];
  columnWidths?: Partial<Record<EntityListColumnId, number>>;
  columnChipDisplay?: Partial<Record<EntityListColumnId, ColumnChipDisplay>>;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  pageAllSelected: boolean;
  pageSomeSelected: boolean;
  sortField: EntityListSortField;
  sortDirection: EntityListSortDirection;
  frozenColumnCount: EntityListFrozenColumnCount;
  freezeColumnsAuto?: boolean;
  compactRows?: boolean;
  onColumnWidthChange?: (columnId: EntityListColumnId, width: number | null) => void;
  onSortChange: (field: EntityListSortField, direction: EntityListSortDirection) => void;
  onSelect: (entityId: string) => void;
  onBulkRowToggle: (entityId: string, checked: boolean) => void;
  onBulkPageToggle: (checked: boolean) => void;
};

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: EntityListSortDirection;
}) {
  if (!active) {
    return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />;
  }
  if (direction === "asc") {
    return <ArrowUp className="h-3.5 w-3.5 text-primary" aria-hidden />;
  }
  return <ArrowDown className="h-3.5 w-3.5 text-primary" aria-hidden />;
}

export function EntityListTable({
  rows,
  columns,
  columnWidths,
  columnChipDisplay,
  selectedId,
  bulkSelectedIds,
  pageAllSelected,
  pageSomeSelected,
  sortField,
  sortDirection,
  frozenColumnCount,
  freezeColumnsAuto = false,
  compactRows = false,
  onColumnWidthChange,
  onSortChange,
  onSelect,
  onBulkRowToggle,
  onBulkPageToggle,
}: Props) {
  const { deviceClass } = useDeviceClass();
  const cellPadding = compactRows ? "p-1.5" : "p-2.5";
  const selectionColumnRef = useRef<HTMLTableCellElement | null>(null);
  const widthRemeasureKey = useMemo(
    () => JSON.stringify(columnWidths ?? {}),
    [columnWidths]
  );
  const resolvedFrozenCount = resolveListFrozenColumnCount(frozenColumnCount, deviceClass);
  const frozen = useFrozenListColumns({
    columnCount: columns.length,
    frozenColumnCount: resolvedFrozenCount,
    freezeColumnsAuto,
    leadingColumnRef: selectionColumnRef,
    remeasureKey: `${rows.length}:${widthRemeasureKey}`,
  });
  const resolveAutoWidth = useCallback(
    (columnId: EntityListColumnId, index: number) => {
      const column = getEntityColumnDef(columnId);
      return resolveListColumnAutoWidth({
        column,
        deviceClass,
        headerElement: frozen.headerRefs.current[index],
        bodyTexts: rows.flatMap((row) => getEntityListCellDisplayTexts(columnId, row)),
        sortable: isSortableEntityColumn(columnId),
        measure: measureHintsFromValueKind(column, {
          statusBadge: columnId === "is_active",
        }),
      });
    },
    [deviceClass, frozen.headerRefs, rows]
  );
  const resize = useResizableListColumns({
    columns,
    columnWidths,
    deviceClass,
    getColumnDef: getEntityColumnDef,
    headerRefs: frozen.headerRefs,
    resolveAutoWidth,
  });

  const selectionHeaderClass = cn(
    LIST_TABLE_HEADER_CELL,
    "w-10 p-0 text-center",
    frozen.effectiveFrozenCount > 0 && LIST_TABLE_HEADER_CELL_BG
  );

  const selectionBodyClass = (selected: boolean) =>
    cn(
      cellPadding,
      "text-center",
      listTableLeadingCellInteractionClass(selected)
    );

  return (
    <div className={LIST_TABLE_ROOT}>
      <div className={LIST_TABLE_SURFACE}>
        <div ref={frozen.scrollContainerRef} className={LIST_TABLE_SCROLL}>
          <table className={listTableElementClass("wide")}>
            <thead>
              <tr className="bg-muted text-left">
                <th
                  ref={selectionColumnRef}
                  scope="col"
                  className={cn(
                    "sticky left-0 top-0 isolate overflow-hidden rounded-tl-lg",
                    LIST_TABLE_HEADER_CELL_BG,
                    selectionHeaderClass
                  )}
                style={{ zIndex: LIST_SELECTION_COLUMN_Z_HEADER }}
                onClick={(event) => event.stopPropagation()}
              >
                <Checkbox
                  className={LIST_TABLE_CHECKBOX_CLASS}
                  checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false}
                  onCheckedChange={(checked) => onBulkPageToggle(checked === true)}
                  aria-label="Select all listed entities"
                />
              </th>
              {columns.map((columnId, index) => {
                const column = getEntityColumnDef(columnId);
                const sortable = isSortableEntityColumn(columnId);
                const isActiveSort = sortField === columnId;
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
                      sortable && LIST_TABLE_HEADER_SORTABLE,
                      sticky.className,
                      frozen.headerCellClass(index),
                      column.align === "center" && "text-center",
                      column.align === "right" && "text-right",
                      isActiveSort && "text-foreground",
                      index === columns.length - 1 && "rounded-tr-lg"
                    )}
                    style={mergeColumnCellStyles(
                      sticky.style,
                      widthStyles,
                      !isFrozen ? { zIndex: LIST_TABLE_HEADER_Z + (columns.length - index) } : {}
                    )}
                    aria-sort={
                      sortable
                        ? isActiveSort
                          ? sortDirection === "asc"
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    onClick={() => {
                      if (!sortable) return;
                      const next = toggleEntityColumnSort(columnId, sortField, sortDirection);
                      onSortChange(next.field, next.direction);
                    }}
                  >
                    {sortable ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1",
                          column.align === "right" && "justify-end",
                          column.align === "center" && "justify-center"
                        )}
                      >
                        {column.label}
                        <SortIndicator active={isActiveSort} direction={sortDirection} />
                      </span>
                    ) : (
                      column.label
                    )}
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
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="p-6 text-center text-sm text-muted-foreground"
                >
                  No entities match your search.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const selected = selectedId === row.id;
                const bulkSelected = bulkSelectedIds.has(row.id);

                return (
                  <tr
                    key={row.id}
                    tabIndex={0}
                    role="button"
                    className={cn(
                      listTableRowClass(selected),
                      !row.is_active && "opacity-60"
                    )}
                    onClick={() => onSelect(row.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        onSelect(row.id);
                      }
                    }}
                  >
                    <td
                      className={cn(
                        "sticky left-0 isolate",
                        LIST_TABLE_BODY_CELL,
                        selectionBodyClass(selected)
                      )}
                      style={{ zIndex: LIST_SELECTION_COLUMN_Z_BODY }}
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                    >
                      <Checkbox
                        className={LIST_TABLE_CHECKBOX_CLASS}
                        checked={bulkSelected}
                        onCheckedChange={(checked) =>
                          onBulkRowToggle(row.id, checked === true)
                        }
                        aria-label={`Select ${row.name}`}
                      />
                    </td>
                    {columns.map((columnId, index) => {
                      const column = getEntityColumnDef(columnId);
                      const sticky = frozen.getStickyCellProps(index, "body");
                      const widthStyles = resize.resolveWidthStyles(columnId, index);
                      return (
                        <td
                          key={columnId}
                          className={cn(
                            LIST_TABLE_BODY_CELL,
                            cellPadding,
                            sticky.className,
                            frozen.bodyCellClass(index, selected),
                            column.align === "center" && "text-center",
                            column.align === "right" && "text-right tabular-nums"
                          )}
                          style={mergeColumnCellStyles(sticky.style, widthStyles)}
                        >
                          {renderEntityListCell(columnId, row, { chipDisplay: columnChipDisplay })}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
