"use client";

import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";
import { renderProductListCell } from "@/components/products/product-list-cells";

type Props = {
  products: ProductListRow[];
  columns: ProductListColumnId[];
  selectedId: string | null;
  onSelect: (productId: string) => void;
};

export function ProductListCompact({ products, columns, selectedId, onSelect }: Props) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border">
      {products.map((product) => {
        const selected = selectedId === product.id;
        const nameColumn = columns.includes("name") ? "name" : columns[0];

        return (
          <button
            key={product.id}
            type="button"
            onClick={() => onSelect(product.id)}
            className={cn(
              "flex w-full flex-col gap-1.5 px-3 py-2.5 text-left transition-colors duration-200 hover:bg-accent/40",
              selected && "bg-primary/5 ring-1 ring-inset ring-primary/20"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">{renderProductListCell(nameColumn, product)}</div>
              {columns
                .filter((id) => id !== nameColumn && (id === "is_active" || id === "default_sku"))
                .slice(0, 2)
                .map((columnId) => (
                  <span key={columnId} className="shrink-0 text-xs text-muted-foreground">
                    {renderProductListCell(columnId, product)}
                  </span>
                ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {columns
                .filter((id) => id !== nameColumn && id !== "is_active" && id !== "default_sku")
                .map((columnId) => (
                  <span key={columnId} className="inline-flex items-center gap-1">
                    <span className="font-medium text-foreground/70">{getColumnDef(columnId).label}:</span>
                    {renderProductListCell(columnId, product)}
                  </span>
                ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
