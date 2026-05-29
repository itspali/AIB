"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListFrozenColumnCount } from "@/lib/products/list-prefs";
import {
  isSortableColumn,
  toggleColumnSort,
  type ProductListSortDirection,
  type ProductListSortField,
} from "@/lib/products/list-sort";
import type { ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";
import { productListCellClassName, renderProductListCell } from "@/components/products/product-list-cells";

type Props = {
  products: ProductListRow[];
  columns: ProductListColumnId[];
  selectedId: string | null;
  sortField: ProductListSortField;
  sortDirection: ProductListSortDirection;
  frozenColumnCount: ProductListFrozenColumnCount;
  onSortChange: (field: ProductListSortField, direction: ProductListSortDirection) => void;
  onSelect: (productId: string) => void;
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

export function ProductListTable({
  products,
  columns,
  selectedId,
  sortField,
  sortDirection,
  frozenColumnCount,
  onSortChange,
  onSelect,
}: Props) {
  const headerRefs = useRef<(HTMLTableCellElement | null)[]>([]);
  const [stickyOffsets, setStickyOffsets] = useState<number[]>([]);
  const effectiveFrozenCount = Math.min(
    frozenColumnCount,
    columns.length
  ) as ProductListFrozenColumnCount;

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
  }, [columns, effectiveFrozenCount, products.length]);

  const getStickyCellProps = (
    index: number,
    variant: "header" | "body",
    selected: boolean
  ) => {
    if (effectiveFrozenCount === 0 || index >= effectiveFrozenCount) {
      return { className: "", style: undefined };
    }

    const isLastFrozen = index === effectiveFrozenCount - 1;

    return {
      className: cn(
        "sticky z-10",
        variant === "header" && "bg-muted/95 backdrop-blur-sm",
        variant === "body" &&
          (selected
            ? "bg-primary/5 group-hover:bg-primary/5"
            : "bg-background group-hover:bg-accent/40"),
        isLastFrozen && "shadow-[2px_0_6px_-2px_rgba(0,0,0,0.12)]"
      ),
      style: { left: stickyOffsets[index] ?? 0 },
    };
  };

  return (
    <div className="surface-inset overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            {columns.map((columnId, index) => {
              const column = getColumnDef(columnId);
              const sortable = isSortableColumn(columnId);
              const isActiveSort = sortable && sortField === columnId;
              const sticky = getStickyCellProps(index, "header", false);

              return (
                <th
                  key={columnId}
                  ref={(element) => {
                    headerRefs.current[index] = element;
                  }}
                  className={cn(
                    "whitespace-nowrap p-0 font-medium text-muted-foreground",
                    column.align === "center" && "text-center",
                    column.align === "right" && "text-right",
                    sticky.className
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
                        "inline-flex w-full items-center gap-1.5 p-2.5 transition-colors hover:bg-accent/50 hover:text-foreground",
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
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {products.map((product) => {
            const selected = selectedId === product.id;
            return (
              <tr
                key={product.id}
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
                  "group cursor-pointer border-b border-border transition-colors duration-200 last:border-0 hover:bg-accent/40",
                  selected && "bg-primary/5 ring-1 ring-inset ring-primary/20"
                )}
              >
                {columns.map((columnId, index) => {
                  const sticky = getStickyCellProps(index, "body", selected);
                  return (
                    <td
                      key={columnId}
                      className={cn(
                        columnId === "image" ? "p-1" : "max-w-[240px] truncate p-2.5",
                        productListCellClassName(columnId),
                        getColumnDef(columnId).align === "center" && "text-center",
                        getColumnDef(columnId).align === "right" && "text-right",
                        sticky.className
                      )}
                      style={sticky.style}
                    >
                      {renderProductListCell(columnId, product)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
