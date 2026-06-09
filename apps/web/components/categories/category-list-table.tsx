"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useCallback, useMemo, useRef } from "react";
import {
  categoryListCellClassName,
  categoryListCellWrapClassName,
  renderCategoryListCell,
} from "@/components/categories/category-list-cells";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
import { Checkbox } from "@/components/ui/checkbox";
import type { DeviceClass } from "@/lib/layout/device-class";
import { getCategoryListCellDisplayTexts } from "@/lib/categories/list-column-display-text";
import {
  getCategoryColumnDef,
  type CategoryListColumnId,
} from "@/lib/categories/list-columns";
import type { CategoryListRow } from "@/lib/categories/list-row";
import type { CategoryListFrozenColumnCount } from "@/lib/categories/list-prefs";
import {
  isSortableCategoryColumn,
  toggleCategoryColumnSort,
  type CategoryListSortDirection,
  type CategoryListSortField,
} from "@/lib/categories/list-sort";
import { getColumnResizeBounds, mergeColumnCellStyles } from "@/lib/list-columns/sizing";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import {
  LIST_TABLE_BODY_CELL,
  LIST_TABLE_FROZEN_EDGE_SHADOW,
  LIST_TABLE_CHECKBOX_CLASS,
  LIST_TABLE_HEADER_CELL_BG,
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
  useFrozenListColumns,
} from "@/lib/list-columns/use-frozen-list-columns";
import {
  measureHintsFromValueKind,
  resolveListColumnAutoWidth,
} from "@/lib/list-columns/resolve-column-auto-width";
import { useResizableListColumns } from "@/lib/list-columns/use-resizable-list-columns";
import { cn } from "@/lib/utils";

type Props = {
  rows: CategoryListRow[];
  columns: CategoryListColumnId[];
  columnWrapModes?: Partial<Record<CategoryListColumnId, TextWrapMode>>;
  columnChipDisplay?: Partial<Record<CategoryListColumnId, ColumnChipDisplay>>;
  columnWidths?: Partial<Record<CategoryListColumnId, number>>;
  deviceClass: DeviceClass;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  pageAllSelected: boolean;
  pageSomeSelected: boolean;
  sortField: CategoryListSortField;
  sortDirection: CategoryListSortDirection;
  frozenColumnCount: CategoryListFrozenColumnCount;
  freezeColumnsAuto?: boolean;
  compactRows?: boolean;
  onSortChange: (field: CategoryListSortField, direction: CategoryListSortDirection) => void;
  onColumnWidthChange?: (columnId: CategoryListColumnId, width: number | null) => void;
  onSelect: (categoryId: string) => void;
  onBulkRowToggle: (categoryId: string, checked: boolean) => void;
  onBulkPageToggle: (checked: boolean) => void;
};

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: CategoryListSortDirection;
}) {
  if (!active) {
    return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden />;
  }
  if (direction === "asc") {
    return <ArrowUp className="h-3.5 w-3.5 text-primary" aria-hidden />;
  }
  return <ArrowDown className="h-3.5 w-3.5 text-primary" aria-hidden />;
}

const HEADER_HOVER =
  "hover:bg-[color-mix(in_srgb,hsl(var(--primary))_18%,hsl(var(--background)))] dark:hover:bg-[color-mix(in_srgb,hsl(var(--accent))_50%,hsl(var(--muted)))]";

function cellPadding(compactRows: boolean): string {
  return compactRows ? "p-1.5" : "p-2.5";
}

export function CategoryListTable({
  rows,
  columns,
  columnWrapModes,
  columnChipDisplay,
  columnWidths,
  deviceClass,
  selectedId,
  bulkSelectedIds,
  pageAllSelected,
  pageSomeSelected,
  sortField,
  sortDirection,
  frozenColumnCount,
  freezeColumnsAuto = false,
  compactRows = false,
  onSortChange,
  onColumnWidthChange,
  onSelect,
  onBulkRowToggle,
  onBulkPageToggle,
}: Props) {
  const selectionColumnRef = useRef<HTMLTableCellElement | null>(null);
  const widthRemeasureKey = useMemo(
    () => JSON.stringify({ columnWidths, columnWrapModes }),
    [columnWidths, columnWrapModes]
  );
  const frozen = useFrozenListColumns({
    columnCount: columns.length,
    frozenColumnCount: Math.min(frozenColumnCount, columns.length) as CategoryListFrozenColumnCount,
    freezeColumnsAuto,
    leadingColumnRef: selectionColumnRef,
    remeasureKey: `${rows.length}:${widthRemeasureKey}`,
  });
  const resolveAutoWidth = useCallback(
    (columnId: CategoryListColumnId, index: number) => {
      const column = getCategoryColumnDef(columnId);
      return resolveListColumnAutoWidth({
        column,
        deviceClass,
        headerElement: frozen.headerRefs.current[index],
        bodyTexts: rows.flatMap((row) => getCategoryListCellDisplayTexts(columnId, row)),
        sortable: isSortableCategoryColumn(columnId),
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
    getColumnDef: getCategoryColumnDef,
    headerRefs: frozen.headerRefs,
    wrapModeForColumn: (columnId) => columnWrapModes?.[columnId] ?? "truncate",
    resolveAutoWidth,
  });

  const selectionColumnShowsEdge =
    frozen.hasHorizontalScroll && frozen.effectiveFrozenCount === 0;

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
          <table className={listTableElementClass("narrow", compactRows)}>
            <thead>
              <tr className="text-left">
                <th
                  ref={selectionColumnRef}
                  className={cn(
                    "sticky left-0 top-0 isolate overflow-hidden rounded-tl-lg",
                    selectionHeaderClass
                  )}
                  style={{ zIndex: LIST_SELECTION_COLUMN_Z_HEADER }}
                >
                  <div className={cn("flex items-center justify-center", cellPadding(compactRows))}>
                    <Checkbox
                      className={LIST_TABLE_CHECKBOX_CLASS}
                      checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false}
                      onCheckedChange={(checked) => onBulkPageToggle(checked === true)}
                      aria-label="Select all categories on this page"
                    />
                  </div>
                </th>
                {columns.map((columnId, index) => {
                  const column = getCategoryColumnDef(columnId);
                  const sortable = isSortableCategoryColumn(columnId);
                  const isActiveSort = sortable && sortField === columnId;
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
                      className={cn(
                        "relative sticky top-0 overflow-hidden p-0 font-medium text-muted-foreground",
                        sticky.className,
                        frozen.headerCellClass(index),
                        column.align === "center" && "text-center",
                        column.align === "right" && "text-right",
                        index === columns.length - 1 && "rounded-tr-lg"
                      )}
                      style={mergeColumnCellStyles(
                        sticky.style,
                        widthStyles,
                        !isFrozen ? { zIndex: LIST_TABLE_HEADER_Z + (columns.length - index) } : {}
                      )}
                    >
                      {sortable ? (
                        <button
                          type="button"
                          onClick={() => {
                            const next = toggleCategoryColumnSort(
                              columnId,
                              sortField,
                              sortDirection
                            );
                            onSortChange(next.field, next.direction);
                          }}
                          className={cn(
                            "inline-flex w-full min-w-0 items-center gap-1.5 overflow-hidden transition-colors duration-[25ms] hover:text-foreground",
                            cellPadding(compactRows),
                            HEADER_HOVER,
                            column.align === "center" && "justify-center",
                            column.align === "right" && "justify-end",
                            isActiveSort && "text-foreground"
                          )}
                          aria-label={`Sort by ${column.label}${
                            isActiveSort
                              ? ` (${sortDirection === "asc" ? "ascending" : "descending"})`
                              : ""
                          }`}
                        >
                          <span className="truncate">{column.label}</span>
                          <span className="shrink-0">
                            <SortIndicator active={isActiveSort} direction={sortDirection} />
                          </span>
                        </button>
                      ) : (
                        <span className={cn("block truncate", cellPadding(compactRows))}>
                          {column.label}
                        </span>
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
                    No categories match your search.
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
                      onClick={() => onSelect(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onSelect(row.id);
                        }
                      }}
                      className={cn(listTableRowClass(selected), !row.is_active && "opacity-50")}
                    >
                      <td
                        className={cn(
                          "sticky left-0 isolate",
                          LIST_TABLE_BODY_CELL,
                          selectionBodyClass(selected)
                        )}
                        style={{ zIndex: LIST_SELECTION_COLUMN_Z_BODY }}
                      >
                        <div
                          className={cn("flex items-center justify-center", cellPadding(compactRows))}
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
                        </div>
                      </td>
                      {columns.map((columnId, index) => {
                        const column = getCategoryColumnDef(columnId);
                        const sticky = frozen.getStickyCellProps(index, "body");
                        const widthStyles = resize.resolveWidthStyles(columnId, index);

                        return (
                          <td
                            key={columnId}
                            className={cn(
                              LIST_TABLE_BODY_CELL,
                              "overflow-visible",
                              cellPadding(compactRows),
                              categoryListCellClassName(columnId),
                              column.align === "center" && "text-center",
                              column.align === "right" && "text-right",
                              sticky.className,
                              frozen.bodyCellClass(index, selected)
                            )}
                            style={mergeColumnCellStyles(sticky.style, widthStyles)}
                          >
                            <div className={categoryListCellWrapClassName(columnId)}>
                              {renderCategoryListCell(columnId, row, {
                                chipDisplay: columnChipDisplay,
                              })}
                            </div>
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
