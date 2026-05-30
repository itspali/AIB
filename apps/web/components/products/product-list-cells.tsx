"use client";

import type { ReactNode } from "react";
import { Package } from "lucide-react";
import {
  columnSupportsWrapControl,
  defaultWrapModeForValueKind,
  textWrapModeClassName,
  type TextWrapMode,
} from "@/lib/display/text-wrap";
import { formatCurrency, formatDate } from "@/lib/dashboard/format";
import { classificationLabel } from "@/lib/products/classification-labels";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import type { ProductListRow } from "@/lib/products/types";
import { formatVariantAttributesSubline } from "@/lib/products/list-row-key";
import {
  productListRowKindBadgeVariant,
  productListRowKindLabel,
  resolveProductListRowKind,
} from "@/lib/products/variant-strategy";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

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

export function resolveProductListCellTextWrapClass(
  columnId: ProductListColumnId,
  wrapMode?: TextWrapMode,
  viewMode: "table" | "compact" = "table"
): string {
  const column = getColumnDef(columnId);
  if (!columnSupportsWrapControl(column.valueKind)) {
    return "truncate";
  }

  const mode =
    wrapMode ??
    column.defaultWrapMode ??
    defaultWrapModeForValueKind(column.valueKind!, viewMode);

  return textWrapModeClassName(mode, column.valueKind);
}

function wrappedTextValue(
  value: string | null,
  wrapClass: string,
  options?: { muted?: boolean; block?: boolean }
): ReactNode {
  if (!value?.trim()) return "—";
  return (
    <span
      className={cn(
        options?.block && "block",
        options?.muted && "text-muted-foreground",
        wrapClass
      )}
    >
      {value}
    </span>
  );
}

type RenderProductListCellOptions = {
  onImageClick?: (product: ProductListRow) => void;
  showVariants?: boolean;
  wrapMode?: TextWrapMode;
};

export function renderProductListCell(
  columnId: ProductListColumnId,
  product: ProductListRow,
  options?: RenderProductListCellOptions
): ReactNode {
  switch (columnId) {
    case "image":
      if (product.image_url && options?.onImageClick) {
        return (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              options.onImageClick?.(product);
            }}
            className="inline-flex h-8 w-8 shrink-0 cursor-zoom-in items-center justify-center overflow-hidden rounded bg-muted transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label={`View images for ${product.name}`}
          >
            <img
              src={product.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </button>
        );
      }

      return (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <Package className="h-4 w-4 text-muted-foreground" aria-hidden />
          )}
        </span>
      );
    case "name": {
      const subline = options?.showVariants
        ? formatVariantAttributesSubline(product.variant_attributes)
        : null;
      const rowKind = resolveProductListRowKind(product, options?.showVariants ?? false);
      const wrapMode = options?.wrapMode ?? "truncate";
      const nameWrapClass = resolveProductListCellTextWrapClass("name", wrapMode);
      const nameRowClass =
        wrapMode === "wrap"
          ? "flex flex-wrap items-center gap-2"
          : "flex min-w-0 items-center gap-2";
      const nameTextClass =
        wrapMode === "wrap"
          ? cn("font-medium", nameWrapClass)
          : cn("min-w-0 flex-1 font-medium", nameWrapClass);

      return (
        <div className={cn(subline && product.has_variants && "border-l-2 border-border/70 pl-2.5")}>
          <div className={nameRowClass}>
            <span className={nameTextClass}>
              {product.name?.trim() ? product.name : "—"}
            </span>
            {rowKind !== "single" ? (
              <Badge variant={productListRowKindBadgeVariant(rowKind)} className="shrink-0">
                {productListRowKindLabel(rowKind)}
              </Badge>
            ) : null}
          </div>
          {subline ? (
            <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
              {subline}
            </span>
          ) : null}
        </div>
      );
    }
    case "default_sku":
      return (
        <span className="font-mono text-muted-foreground">
          {product.style_code ?? product.default_sku ?? "—"}
        </span>
      );
    case "barcode":
      return (
        <span className="font-mono text-muted-foreground">{product.barcode ?? "—"}</span>
      );
    case "classification":
      return (
        <span className={resolveProductListCellTextWrapClass("classification", options?.wrapMode)}>
          {classificationLabel(product.classification)}
        </span>
      );
    case "category_name":
      return wrappedTextValue(
        product.category_name,
        resolveProductListCellTextWrapClass("category_name", options?.wrapMode)
      );
    case "description":
      return wrappedTextValue(
        product.description,
        resolveProductListCellTextWrapClass("description", options?.wrapMode),
        { muted: true, block: true }
      );
    case "base_unit_of_measure":
      return <span className="font-mono">{product.base_unit_of_measure}</span>;
    case "hsn_sac_code":
      return product.hsn_sac_code ?? "—";
    case "has_variants":
      return formatBoolean(product.has_variants);
    case "default_tax_category":
      return (
        <span
          className={resolveProductListCellTextWrapClass("default_tax_category", options?.wrapMode)}
        >
          {taxCategoryLabel(product.default_tax_category)}
        </span>
      );
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
      return wrappedTextValue(
        product.supplier_name,
        resolveProductListCellTextWrapClass("supplier_name", options?.wrapMode)
      );
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
    return "flex justify-center overflow-visible";
  }

  return "min-w-0";
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
