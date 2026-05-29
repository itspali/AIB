"use client";

import type { ReactNode } from "react";
import { classificationLabel } from "@/lib/products/classification-labels";
import { formatDate } from "@/lib/dashboard/format";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

export function renderProductListCell(
  columnId: ProductListColumnId,
  product: ProductListRow
): ReactNode {
  switch (columnId) {
    case "name":
      return <span className="font-medium">{product.name}</span>;
    case "default_sku":
      return (
        <span className="font-mono text-muted-foreground">{product.default_sku ?? "—"}</span>
      );
    case "classification":
      return classificationLabel(product.classification);
    case "category_name":
      return product.category_name ?? "—";
    case "base_unit_of_measure":
      return <span className="font-mono">{product.base_unit_of_measure}</span>;
    case "is_active":
      return (
        <span className={cn("text-xs font-medium", product.is_active ? "text-emerald-600" : "text-muted-foreground")}>
          {product.is_active ? "Yes" : "No"}
        </span>
      );
    case "is_purchasable":
      return product.is_purchasable ? "Yes" : "No";
    case "is_salable":
      return product.is_salable ? "Yes" : "No";
    case "updated_at":
      return (
        <span className="text-muted-foreground tabular-nums">{formatDate(product.updated_at)}</span>
      );
    default:
      return "—";
  }
}

export function productListCellClassName(columnId: ProductListColumnId): string {
  if (columnId === "default_sku" || columnId === "base_unit_of_measure") {
    return "font-mono text-xs";
  }
  if (columnId === "is_active" || columnId === "is_purchasable" || columnId === "is_salable") {
    return "text-center";
  }
  return "";
}
