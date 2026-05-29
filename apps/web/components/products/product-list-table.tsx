"use client";

import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";
import { productListCellClassName, renderProductListCell } from "@/components/products/product-list-cells";

type Props = {
  products: ProductListRow[];
  columns: ProductListColumnId[];
  selectedId: string | null;
  onSelect: (productId: string) => void;
};

export function ProductListTable({ products, columns, selectedId, onSelect }: Props) {
  return (
    <div className="surface-inset overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-left">
            {columns.map((columnId) => {
              const column = getColumnDef(columnId);
              return (
                <th
                  key={columnId}
                  className={cn(
                    "whitespace-nowrap p-2.5 font-medium text-muted-foreground",
                    column.align === "center" && "text-center"
                  )}
                >
                  {column.label}
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
                  "cursor-pointer border-b border-border transition-colors duration-200 last:border-0 hover:bg-accent/40",
                  selected && "bg-primary/5 ring-1 ring-inset ring-primary/20"
                )}
              >
                {columns.map((columnId) => (
                  <td
                    key={columnId}
                    className={cn(
                      "max-w-[240px] truncate p-2.5",
                      productListCellClassName(columnId),
                      getColumnDef(columnId).align === "center" && "text-center"
                    )}
                  >
                    {renderProductListCell(columnId, product)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
