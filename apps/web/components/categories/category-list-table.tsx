"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  categoryListCellClassName,
  categoryListCellWrapClassName,
  renderCategoryListCell,
} from "@/components/categories/category-list-cells";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
import { Checkbox } from "@/components/ui/checkbox";
import type { DeviceClass } from "@/lib/layout/device-class";
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
import {
  getColumnResizeBounds,
  mergeColumnCellStyles,
  resolveColumnWidthSpec,
  resolveColumnWidthStyles,
} from "@/lib/list-columns/sizing";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
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

const ROW_DIVIDER = "box-border border-b border-border";
const FROZEN_CELL_BG =
  "bg-[color-mix(in_srgb,hsl(var(--primary))_14%,hsl(var(--background)))] dark:bg-muted";
const FROZEN_CELL_HOVER =
  "group-hover:bg-[color-mix(in_srgb,hsl(var(--primary))_18%,hsl(var(--background)))] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--accent))_55%,hsl(var(--muted)))]";
const FROZEN_CELL_SELECTED =
  "bg-[color-mix(in_srgb,hsl(var(--primary))_18%,hsl(var(--background)))] dark:bg-[color-mix(in_srgb,hsl(var(--primary))_14%,hsl(var(--muted)))]";
const FROZEN_CELL_SELECTED_HOVER =
  "group-hover:bg-[color-mix(in_srgb,hsl(var(--primary))_22%,hsl(var(--background)))] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--primary))_14%,hsl(var(--accent))_35%,hsl(var(--muted)))]";
const FROZEN_EDGE_SHADOW =
  "shadow-[inset_-12px_0_18px_-8px_hsl(var(--primary)/0.16)] dark:shadow-[inset_-14px_0_18px_-10px_hsl(0_0%_0%/0.28)]";
const HEADER_HOVER =
  "hover:bg-[color-mix(in_srgb,hsl(var(--primary))_18%,hsl(var(--background)))] dark:hover:bg-[color-mix(in_srgb,hsl(var(--accent))_50%,hsl(var(--muted)))]";
const TABLE_HEADER_Z = 10;
const SELECTION_COLUMN_Z_HEADER = 50;
const FROZEN_HEADER_Z_BASE = 40;
const SELECTION_COLUMN_Z_BODY = 15;
const FROZEN_BODY_Z_BASE = 10;

function selectionColumnEdgeClass(showEdge: boolean) {
  return showEdge ? FROZEN_EDGE_SHADOW : undefined;
}

function rowEdgeClass(isLastFrozenColumn = false) {
  return isLastFrozenColumn ? FROZEN_EDGE_SHADOW : undefined;
}

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
  const headerRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  const selectionColumnRef = useRef<HTMLTableCellElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [stickyOffsets, setStickyOffsets] = useState<number[]>([]);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);
  const [previewWidths, setPreviewWidths] = useState<
    Partial<Record<CategoryListColumnId, number>>
  >({});

  const effectiveFrozenCount = useMemo(() => {
    const requested = Math.min(
      frozenColumnCount,
      columns.length
    ) as CategoryListFrozenColumnCount;
    if (freezeColumnsAuto && !hasHorizontalScroll) return 0 as CategoryListFrozenColumnCount;
    return requested;
  }, [columns.length, freezeColumnsAuto, frozenColumnCount, hasHorizontalScroll]);

  useLayoutEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const measureScroll = () => {
      setHasHorizontalScroll(container.scrollWidth > container.clientWidth + 1);
    };

    measureScroll();

    const observer = new ResizeObserver(measureScroll);
    observer.observe(container);
    const table = container.querySelector("table");
    if (table) observer.observe(table);

    return () => observer.disconnect();
  }, [columns, rows.length]);

  useLayoutEffect(() => {
    if (effectiveFrozenCount === 0) {
      setStickyOffsets([]);
      return;
    }

    let left = selectionColumnRef.current?.offsetWidth ?? 40;
    const offsets: number[] = [];
    for (let index = 0; index < effectiveFrozenCount; index += 1) {
      offsets.push(left);
      left += headerRefs.current[index]?.offsetWidth ?? 0;
    }
    setStickyOffsets(offsets);
  }, [columnWidths, columnWrapModes, columns, deviceClass, effectiveFrozenCount, previewWidths, rows.length]);

  const getUserWidthPx = (columnId: CategoryListColumnId) =>
    previewWidths[columnId] ?? columnWidths?.[columnId];

  const resolveWidthStyles = (columnId: CategoryListColumnId) => {
    const column = getCategoryColumnDef(columnId);
    const wrapMode = columnWrapModes?.[columnId] ?? "truncate";
    return resolveColumnWidthStyles(column, deviceClass, wrapMode, getUserWidthPx(columnId));
  };

  const getHeaderWidthPx = (columnId: CategoryListColumnId, index: number) => {
    const userWidth = getUserWidthPx(columnId);
    if (userWidth != null) return userWidth;

    const measured = headerRefs.current[index]?.offsetWidth;
    if (measured && measured > 0) return measured;

    const column = getCategoryColumnDef(columnId);
    const wrapMode = columnWrapModes?.[columnId] ?? "truncate";
    const spec = resolveColumnWidthSpec(column, deviceClass, wrapMode);
    const preferred = spec.preferred ?? spec.min ?? spec.max;
    return typeof preferred === "number" ? preferred : 120;
  };

  const getStickyCellProps = (
    index: number,
    variant: "header" | "body",
    columnId: CategoryListColumnId
  ) => {
    const widthStyles = resolveWidthStyles(columnId);

    if (effectiveFrozenCount === 0 || index >= effectiveFrozenCount) {
      return { className: "", style: widthStyles };
    }

    const stackOrder = effectiveFrozenCount - 1 - index;
    const zIndex =
      (variant === "header" ? FROZEN_HEADER_Z_BASE : FROZEN_BODY_Z_BASE) + stackOrder;

    return {
      className: cn("sticky isolate overflow-hidden", variant === "header" && "top-0"),
      style: mergeColumnCellStyles({ left: stickyOffsets[index] ?? 0, zIndex }, widthStyles),
    };
  };

  const bodyCellClass = (
    selected: boolean,
    isFrozen: boolean,
    isLastFrozenColumn: boolean,
    isLastRow: boolean
  ) =>
    cn(
      !isLastRow && ROW_DIVIDER,
      "transition-colors duration-[25ms]",
      rowEdgeClass(isFrozen && isLastFrozenColumn),
      !isFrozen &&
        (selected
          ? "bg-[color-mix(in_srgb,hsl(var(--primary))_8%,hsl(var(--background)))] group-hover:bg-[color-mix(in_srgb,hsl(var(--primary))_12%,hsl(var(--muted)))] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--primary))_5%,hsl(var(--accent))_40%,hsl(var(--background)))]"
          : "group-hover:bg-[color-mix(in_srgb,hsl(var(--accent))_35%,hsl(var(--muted)))] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--accent))_40%,hsl(var(--background)))]"),
      isFrozen &&
        (selected
          ? cn(FROZEN_CELL_SELECTED, FROZEN_CELL_SELECTED_HOVER)
          : cn(FROZEN_CELL_BG, FROZEN_CELL_HOVER))
    );

  const headerCellClass = (isFrozen: boolean, isLastFrozenColumn: boolean) =>
    cn(
      "sticky top-0 bg-muted",
      ROW_DIVIDER,
      isFrozen && FROZEN_CELL_BG,
      isFrozen && isLastFrozenColumn && FROZEN_EDGE_SHADOW
    );

  const selectionColumnShowsEdge =
    hasHorizontalScroll && effectiveFrozenCount === 0;

  const selectionHeaderClass = cn(
    ROW_DIVIDER,
    "sticky top-0 bg-muted",
    selectionColumnEdgeClass(selectionColumnShowsEdge)
  );

  const selectionBodyClass = (selected: boolean, isLastRow: boolean) =>
    cn(
      "w-10 p-0",
      !isLastRow && ROW_DIVIDER,
      "transition-colors duration-[25ms]",
      selectionColumnEdgeClass(selectionColumnShowsEdge),
      selected
        ? cn(FROZEN_CELL_SELECTED, FROZEN_CELL_SELECTED_HOVER)
        : cn(FROZEN_CELL_BG, FROZEN_CELL_HOVER)
    );

  const handleColumnAutoFit = useCallback(
    (columnId: CategoryListColumnId, index: number) => {
      if (!onColumnWidthChange) return;
      const column = getCategoryColumnDef(columnId);
      const bounds = getColumnResizeBounds(column, deviceClass);
      const headerWidth = headerRefs.current[index]?.offsetWidth ?? bounds.min;
      onColumnWidthChange(columnId, Math.min(bounds.max, Math.max(bounds.min, headerWidth)));
      setPreviewWidths((current) => {
        const next = { ...current };
        delete next[columnId];
        return next;
      });
    },
    [deviceClass, onColumnWidthChange]
  );

  return (
    <div className="relative min-h-0 w-full flex-1 basis-0 self-stretch">
      <div className="surface-inset absolute inset-0 flex flex-col overflow-hidden">
        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-contain [scrollbar-gutter:stable]"
        >
          <table
            className={cn(
              "w-full min-w-[720px] border-separate border-spacing-0 bg-background [&_td]:box-border [&_th]:box-border",
              compactRows ? "text-xs" : "text-sm"
            )}
          >
            <thead>
              <tr className="bg-muted text-left">
                <th
                  ref={selectionColumnRef}
                  className={cn(
                    "sticky left-0 top-0 isolate overflow-hidden w-10 p-0 font-medium text-muted-foreground",
                    selectionHeaderClass
                  )}
                  style={{ zIndex: SELECTION_COLUMN_Z_HEADER }}
                >
                  <div className={cn("flex items-center justify-center", cellPadding(compactRows))}>
                    <Checkbox
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
                  const sticky = getStickyCellProps(index, "header", columnId);
                  const isFrozen = effectiveFrozenCount > 0 && index < effectiveFrozenCount;
                  const isLastFrozenColumn =
                    effectiveFrozenCount > 0 && index === effectiveFrozenCount - 1;

                  return (
                    <th
                      key={columnId}
                      ref={(element) => {
                        headerRefs.current[index] = element;
                      }}
                      className={cn(
                        "relative sticky top-0 overflow-hidden p-0 font-medium text-muted-foreground",
                        sticky.className,
                        headerCellClass(isFrozen, isLastFrozenColumn),
                        column.align === "center" && "text-center",
                        column.align === "right" && "text-right"
                      )}
                      style={mergeColumnCellStyles(
                        sticky.style,
                        !isFrozen ? { zIndex: TABLE_HEADER_Z + (columns.length - index) } : {}
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
                          getWidth={() => getHeaderWidthPx(columnId, index)}
                          minWidth={getColumnResizeBounds(column, deviceClass).min}
                          maxWidth={getColumnResizeBounds(column, deviceClass).max}
                          onPreview={(width) =>
                            setPreviewWidths((current) => ({ ...current, [columnId]: width }))
                          }
                          onCommit={(width) => {
                            setPreviewWidths((current) => {
                              const next = { ...current };
                              delete next[columnId];
                              return next;
                            });
                            onColumnWidthChange(columnId, width);
                          }}
                          onAutoFit={() => handleColumnAutoFit(columnId, index)}
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
                rows.map((row, rowIndex) => {
                  const selected = selectedId === row.id;
                  const bulkSelected = bulkSelectedIds.has(row.id);
                  const isLastRow = rowIndex === rows.length - 1;
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
                      className={cn(
                        "group cursor-pointer transition-colors duration-[25ms]",
                        !row.is_active && "opacity-50",
                        selected && "ring-1 ring-inset ring-primary/20"
                      )}
                    >
                      <td
                        className={cn("sticky left-0 isolate", selectionBodyClass(selected, isLastRow))}
                        style={{ zIndex: SELECTION_COLUMN_Z_BODY }}
                      >
                        <div
                          className={cn("flex items-center justify-center", cellPadding(compactRows))}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <Checkbox
                            checked={bulkSelected}
                            onCheckedChange={(checked) =>
                              onBulkRowToggle(row.id, checked === true)
                            }
                            aria-label={`Select ${row.name}`}
                          />
                        </div>
                      </td>
                      {columns.map((columnId, index) => {
                        const isFrozen = effectiveFrozenCount > 0 && index < effectiveFrozenCount;
                        const sticky = getStickyCellProps(index, "body", columnId);
                        const isLastFrozenColumn =
                          effectiveFrozenCount > 0 && index === effectiveFrozenCount - 1;
                        const column = getCategoryColumnDef(columnId);
                        return (
                          <td
                            key={columnId}
                            className={cn(
                              "overflow-visible",
                              cellPadding(compactRows),
                              categoryListCellClassName(columnId),
                              column.align === "center" && "text-center",
                              column.align === "right" && "text-right",
                              sticky.className,
                              bodyCellClass(selected, isFrozen, isLastFrozenColumn, isLastRow)
                            )}
                            style={sticky.style}
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
