"use client";

import { Package } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/dashboard/format";
import { classificationLabel } from "@/lib/products/classification-labels";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import type { ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

function formatOptionalCurrency(value: string | null): string {
  if (!value || value.trim() === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatCurrency(parsed) : value;
}

function formatBoolean(value: boolean): ReactNode {
  return (
    <span className={cn("text-xs font-medium", value ? "text-emerald-600" : "text-muted-foreground")}>
      {value ? "Yes" : "No"}
    </span>
  );
}

function formatActiveStatus(value: boolean): ReactNode {
  return (
    <Badge
      variant={value ? "completed" : "locked"}
      className={cn(
        "shrink-0 whitespace-nowrap ring-0",
        value ? "border border-emerald-500/30" : "border border-border"
      )}
    >
      {value ? "Active" : "Inactive"}
    </Badge>
  );
}

function truncateText(value: string | null, maxLength = 80): ReactNode {
  if (!value?.trim()) return "—";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

export function renderProductListCell(
  columnId: ProductListColumnId,
  product: ProductListRow
): ReactNode {
  switch (columnId) {
    case "image":
      return product.image_url ? (
        <img
          src={product.image_url}
          alt=""
          className="h-8 w-8 rounded object-cover bg-muted"
          loading="lazy"
        />
      ) : (
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded bg-muted text-muted-foreground"
          aria-hidden
        >
          <Package className="h-4 w-4" />
        </span>
      );
    case "name":
      return <span className="font-medium">{product.name}</span>;
    case "default_sku":
      return (
        <span className="font-mono text-muted-foreground">{product.default_sku ?? "—"}</span>
      );
    case "barcode":
      return (
        <span className="font-mono text-muted-foreground">{product.barcode ?? "—"}</span>
      );
    case "classification":
      return classificationLabel(product.classification);
    case "category_name":
      return product.category_name ?? "—";
    case "description":
      return (
        <span className="text-muted-foreground">{truncateText(product.description)}</span>
      );
    case "base_unit_of_measure":
      return <span className="font-mono">{product.base_unit_of_measure}</span>;
    case "hsn_sac_code":
      return product.hsn_sac_code ?? "—";
    case "has_variants":
      return formatBoolean(product.has_variants);
    case "default_tax_category":
      return taxCategoryLabel(product.default_tax_category);
    case "is_active":
      return formatActiveStatus(product.is_active);
    case "is_purchasable":
      return formatBoolean(product.is_purchasable);
    case "is_salable":
      return formatBoolean(product.is_salable);
    case "is_returnable":
      return formatBoolean(product.is_returnable);
    case "selling_price":
      return (
        <span className="tabular-nums">{formatOptionalCurrency(product.selling_price)}</span>
      );
    case "purchase_price":
      return (
        <span className="tabular-nums">{formatOptionalCurrency(product.purchase_price)}</span>
      );
    case "supplier_name":
      return product.supplier_name ?? "—";
    case "stock_on_hand": {
      const qty = product.stock_on_hand;
      if (qty == null || qty.trim() === "") return "—";
      const parsed = Number(qty);
      return (
        <span className="tabular-nums">
          {Number.isFinite(parsed) ? parsed.toLocaleString() : qty}
        </span>
      );
    }
    case "created_at":
      return (
        <span className="text-muted-foreground tabular-nums">{formatDate(product.created_at)}</span>
      );
    case "updated_at":
      return (
        <span className="text-muted-foreground tabular-nums">{formatDate(product.updated_at)}</span>
      );
    default:
      return "—";
  }
}

export function productListCellWrapClassName(columnId: ProductListColumnId): string {
  if (columnId === "image" || columnId === "is_active") {
    return columnId === "is_active" ? "flex justify-center overflow-visible" : "";
  }
  return "truncate";
}

export function productListCellClassName(columnId: ProductListColumnId): string {
  if (columnId === "image") {
    return "w-12 max-w-[48px] p-1 text-center";
  }
  if (
    columnId === "default_sku" ||
    columnId === "barcode" ||
    columnId === "base_unit_of_measure"
  ) {
    return "font-mono text-xs";
  }
  if (columnId === "is_active") {
    return "w-24 min-w-24 text-center";
  }
  if (
    columnId === "is_purchasable" ||
    columnId === "is_salable" ||
    columnId === "is_returnable" ||
    columnId === "has_variants"
  ) {
    return "text-center";
  }
  if (
    columnId === "selling_price" ||
    columnId === "purchase_price" ||
    columnId === "stock_on_hand"
  ) {
    return "text-right tabular-nums";
  }
  return "";
}
