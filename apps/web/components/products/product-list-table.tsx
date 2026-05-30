"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { ListColumnResizeHandle } from "@/components/list-columns/list-column-resize-handle";
import type { DeviceClass } from "@/lib/layout/device-class";
import {
  getColumnResizeBounds,
  mergeColumnCellStyles,
  resolveColumnWidthSpec,
  resolveColumnWidthStyles,
} from "@/lib/list-columns/sizing";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListFrozenColumnCount } from "@/lib/products/list-prefs";
import {
  isSortableColumn,
  toggleColumnSort,
  type ProductListSortDirection,
  type ProductListSortField,
} from "@/lib/products/list-sort";
import type { ProductListRow } from "@/lib/products/types";
import {
  formatVariantAttributesSubline,
  isProductListRowInactive,
  productListRowKey,
} from "@/lib/products/list-row-key";
import { cn } from "@/lib/utils";
import {
  productListCellClassName,
  productListCellWrapClassName,
  renderProductListCell,
} from "@/components/products/product-list-cells";

type Props = {
  products: ProductListRow[];
  columns: ProductListColumnId[];
  columnWrapModes?: Partial<Record<ProductListColumnId, TextWrapMode>>;
  columnWidths?: Partial<Record<ProductListColumnId, number>>;
  deviceClass: DeviceClass;
  showVariants?: boolean;
  selectedId: string | null;
  bulkSelectedIds: Set<string>;
  pageAllSelected: boolean;
  pageSomeSelected: boolean;
  sortField: ProductListSortField;
  sortDirection: ProductListSortDirection;
  frozenColumnCount: ProductListFrozenColumnCount;
  freezeColumnsAuto?: boolean;
  onSortChange: (field: ProductListSortField, direction: ProductListSortDirection) => void;
  onColumnWidthChange?: (columnId: ProductListColumnId, width: number | null) => void;
  onSelect: (productId: string) => void;
  onBulkRowToggle: (rowKey: string, checked: boolean) => void;
  onBulkPageToggle: (checked: boolean) => void;
  onImageClick?: (product: ProductListRow) => void;
};

function SortIndicator({
  active,
  direction,
}: {
  active: boolean;
  direction: ProductListSortDirection;
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
  "bg-[color-mix(in_srgb,hsl(var(--primary))_10%,hsl(var(--background)))] dark:bg-muted";
const FROZEN_CELL_HOVER =
  "group-hover:bg-[color-mix(in_srgb,hsl(var(--primary))_15%,hsl(var(--background)))] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--accent))_55%,hsl(var(--muted)))]";
const FROZEN_CELL_SELECTED =
  "bg-[color-mix(in_srgb,hsl(var(--primary))_15%,hsl(var(--background)))] dark:bg-[color-mix(in_srgb,hsl(var(--primary))_14%,hsl(var(--muted)))]";
const FROZEN_CELL_SELECTED_HOVER =
  "group-hover:bg-[color-mix(in_srgb,hsl(var(--primary))_20%,hsl(var(--background)))] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--primary))_14%,hsl(var(--accent))_35%,hsl(var(--muted)))]";
const FROZEN_EDGE_SHADOW =
  "shadow-[inset_-12px_0_18px_-8px_hsl(var(--primary)/0.08)] dark:shadow-[inset_-14px_0_18px_-10px_hsl(0_0%_0%/0.28)]";
const HEADER_HOVER =
  "hover:bg-[color-mix(in_srgb,hsl(var(--primary))_15%,hsl(var(--background)))] dark:hover:bg-[color-mix(in_srgb,hsl(var(--accent))_50%,hsl(var(--muted)))]";

function rowEdgeClass(isLastFrozenColumn = false) {
  return isLastFrozenColumn ? FROZEN_EDGE_SHADOW : undefined;
}

export function ProductListTable({
  products,
  columns,
  columnWrapModes,
  columnWidths,
  deviceClass,
  showVariants = false,
  selectedId,
  bulkSelectedIds,
  pageAllSelected,
  pageSomeSelected,
  sortField,
  sortDirection,
  frozenColumnCount,
  freezeColumnsAuto = false,
  onSortChange,
  onColumnWidthChange,
  onSelect,
  onBulkRowToggle,
  onBulkPageToggle,
  onImageClick,
}: Props) {
  const headerRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [stickyOffsets, setStickyOffsets] = useState<number[]>([]);
  const [hasHorizontalScroll, setHasHorizontalScroll] = useState(false);
  const [previewWidths, setPreviewWidths] = useState<
    Partial<Record<ProductListColumnId, number>>
  >({});

  const effectiveFrozenCount = useMemo(() => {
    const requested = Math.min(
      frozenColumnCount,
      columns.length
    ) as ProductListFrozenColumnCount;
    if (freezeColumnsAuto && !hasHorizontalScroll) return 0 as ProductListFrozenColumnCount;
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
  }, [columns, products.length]);

  useLayoutEffect(() => {
    if (effectiveFrozenCount === 0) {
      setStickyOffsets([]);
      return;
    }

    let left = 0;
    const offsets: number[] = [];
    for (let index = 0; index < effectiveFrozenCount; index += 1) {
      offsets.push(left);
      left += headerRefs.current[index]?.offsetWidth ?? 0;
    }
    setStickyOffsets(offsets);
  }, [columnWidths, columnWrapModes, columns, deviceClass, effectiveFrozenCount, previewWidths, products.length]);

  const getUserWidthPx = (columnId: ProductListColumnId) =>
    previewWidths[columnId] ?? columnWidths?.[columnId];

  const resolveWidthStyles = (columnId: ProductListColumnId) => {
    const column = getColumnDef(columnId);
    const wrapMode = columnWrapModes?.[columnId] ?? "truncate";
    return resolveColumnWidthStyles(column, deviceClass, wrapMode, getUserWidthPx(columnId));
  };

  const getHeaderWidthPx = (columnId: ProductListColumnId, index: number) => {
    const userWidth = getUserWidthPx(columnId);
    if (userWidth != null) return userWidth;

    const measured = headerRefs.current[index]?.offsetWidth;
    if (measured && measured > 0) return measured;

    const column = getColumnDef(columnId);
    const wrapMode = columnWrapModes?.[columnId] ?? "truncate";
    const spec = resolveColumnWidthSpec(column, deviceClass, wrapMode);
    const preferred = spec.preferred ?? spec.min ?? spec.max;
    return typeof preferred === "number" ? preferred : 120;
  };

  const getStickyCellProps = (index: number, variant: "header" | "body", columnId: ProductListColumnId) => {
    const widthStyles = resolveWidthStyles(columnId);

    if (effectiveFrozenCount === 0 || index >= effectiveFrozenCount) {
      return { className: "", style: widthStyles };
    }

    const zIndex = (variant === "header" ? 20 : 10) + index;

    return {
      className: "sticky",
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
          ? "bg-[color-mix(in_srgb,hsl(var(--primary))_5%,hsl(var(--background)))] group-hover:bg-[color-mix(in_srgb,hsl(var(--primary))_8%,hsl(214_28%_94%))] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--primary))_5%,hsl(var(--accent))_40%,hsl(var(--background)))]"
          : "group-hover:bg-[hsl(214_28%_96%)] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--accent))_40%,hsl(var(--background)))]"),
      isFrozen &&
        (selected
          ? cn(FROZEN_CELL_SELECTED, FROZEN_CELL_SELECTED_HOVER)
          : cn(FROZEN_CELL_BG, FROZEN_CELL_HOVER))
    );

  const headerCellClass = (isFrozen: boolean, isLastFrozenColumn: boolean) =>
    cn(ROW_DIVIDER, isFrozen && FROZEN_CELL_BG, isFrozen && isLastFrozenColumn && FROZEN_EDGE_SHADOW);

  return (
    <div className="relative">
      <div
        ref={scrollContainerRef}
        className="surface-inset overflow-x-auto [scrollbar-gutter:stable]"
      >
        <table className="w-full min-w-[720px] border-separate border-spacing-0 bg-background text-sm [&_td]:box-border [&_th]:box-border">
        <thead>
          <tr className="bg-muted/40 text-left">
            <th className={cn("w-10 p-0 font-medium text-muted-foreground", ROW_DIVIDER)}>
              <div className="flex items-center justify-center p-2.5">
                <Checkbox
                  checked={pageAllSelected ? true : pageSomeSelected ? "indeterminate" : false}
                  onCheckedChange={(checked) => onBulkPageToggle(checked === true)}
                  aria-label="Select all items on this page"
                />
              </div>
            </th>
            {columns.map((columnId, index) => {
              const column = getColumnDef(columnId);
              const sortable = isSortableColumn(columnId);
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
                    "relative whitespace-nowrap p-0 font-medium text-muted-foreground",
                    sticky.className,
                    headerCellClass(isFrozen, isLastFrozenColumn),
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right"
                  )}
                  style={sticky.style}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => {
                        const next = toggleColumnSort(columnId, sortField, sortDirection);
                        onSortChange(next.field, next.direction);
                      }}
                      className={cn(
                        "inline-flex w-full items-center gap-1.5 p-2.5 transition-colors duration-[25ms] hover:text-foreground",
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
                      <span>{column.label}</span>
                      <SortIndicator active={isActiveSort} direction={sortDirection} />
                    </button>
                  ) : (
                    <span className="block p-2.5">{column.label}</span>
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
                    />
                  ) : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {products.map((product, rowIndex) => {
            const rowKey = productListRowKey(product, showVariants);
            const selected = selectedId === product.id;
            const bulkSelected = bulkSelectedIds.has(rowKey);
            const isLastRow = rowIndex === products.length - 1;
            const rowInactive = isProductListRowInactive(product, showVariants);
            return (
              <tr
                key={rowKey}
                tabIndex={0}
                role="button"
                onClick={() => onSelect(product.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(product.id);
                  }
                }}
                className={cn(
                  "group cursor-pointer transition-colors duration-[25ms]",
                  rowInactive && "opacity-50",
                  selected && "ring-1 ring-inset ring-primary/20"
                )}
              >
                <td
                  className={cn(
                    "w-10 p-0",
                    !isLastRow && ROW_DIVIDER,
                    "transition-colors duration-[25ms]",
                    "group-hover:bg-[hsl(214_28%_96%)] dark:group-hover:bg-[color-mix(in_srgb,hsl(var(--accent))_40%,hsl(var(--background)))]"
                  )}
                >
                  <div
                    className="flex items-center justify-center p-2.5"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <Checkbox
                      checked={bulkSelected}
                      onCheckedChange={(checked) =>
                        onBulkRowToggle(rowKey, checked === true)
                      }
                      aria-label={`Select ${product.name}${
                        product.default_sku ? ` (${product.default_sku})` : ""
                      }`}
                    />
                  </div>
                </td>
                {columns.map((columnId, index) => {
                  const isFrozen = effectiveFrozenCount > 0 && index < effectiveFrozenCount;
                  const sticky = getStickyCellProps(index, "body", columnId);
                  const isLastFrozenColumn =
                    effectiveFrozenCount > 0 && index === effectiveFrozenCount - 1;
                  return (
                    <td
                      key={columnId}
                      className={cn(
                        "overflow-visible",
                        columnId === "image" ? "p-1" : "p-2.5",
                        productListCellClassName(columnId),
                        getColumnDef(columnId).align === "center" && "text-center",
                        getColumnDef(columnId).align === "right" && "text-right",
                        sticky.className,
                        bodyCellClass(selected, isFrozen, isLastFrozenColumn, isLastRow)
                      )}
                      style={sticky.style}
                    >
                      <div
                        className={productListCellWrapClassName(
                          columnId,
                          columnWrapModes?.[columnId] ?? "truncate"
                        )}
                      >
                        {renderProductListCell(columnId, product, {
                          onImageClick,
                          showVariants,
                        })}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-background to-transparent"
        aria-hidden
      />
    </div>
  );
}
