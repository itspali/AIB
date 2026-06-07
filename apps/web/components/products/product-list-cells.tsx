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
import { booleanValueKey } from "@/lib/list-columns/chip-colors";
import { renderChipOrText } from "@/lib/list-columns/render-chip-value";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import { CHIP_DEFAULT_FALLBACK_KEY } from "@/lib/list-columns/types";
import { classificationLabel } from "@/lib/products/classification-labels";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import { normalizeTaxCategory, taxCategoryLabel } from "@/lib/products/tax-options";
import type { ProductListRow } from "@/lib/products/types";
import {
  productListVariantNameIndentClass,
  resolveProductListRowPresentation,
} from "@/lib/products/list-row-presentation";
import { cn } from "@/lib/utils";
import type { ProductListViewMode } from "@/lib/products/list-prefs";
function formatOptionalCurrency(value: string | null): string {
  if (!value || value.trim() === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatCurrency(parsed) : value;
}

function formatBooleanText(value: boolean): string {
  return value ? "Yes" : "No";
}

function formatBoolean(
  columnId: ProductListColumnId,
  value: boolean,
  chipDisplay?: Partial<Record<ProductListColumnId, ColumnChipDisplay>>
): ReactNode {
  const column = getColumnDef(columnId);
  const label = formatBooleanText(value);
  return renderChipOrText({
    column,
    valueKey: booleanValueKey(value),
    label,
    textNode: (
      <span
        className={cn(
          "text-xs font-medium",
          value ? "text-emerald-600" : "text-muted-foreground"
        )}
      >
        {label}
      </span>
    ),
    chipDisplay: chipDisplay?.[columnId],
  });
}

function formatActiveStatusText(value: boolean): ReactNode {
  return (
    <span
      className={cn(
        "text-xs font-medium",
        value ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
      )}
    >
      {value ? "Active" : "Inactive"}
    </span>
  );
}

export function renderProductListActiveStatus(
  value: boolean,
  chipDisplay?: ColumnChipDisplay
): ReactNode {
  const column = getColumnDef("is_active");
  const label = value ? "Active" : "Inactive";
  return renderChipOrText({
    column,
    valueKey: booleanValueKey(value),
    label,
    textNode: formatActiveStatusText(value),
    chipDisplay,
  });
}

export function resolveProductListCellTextWrapClass(
  columnId: ProductListColumnId,
  wrapMode?: TextWrapMode,
  viewMode: ProductListViewMode = "table"
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
  chipDisplay?: Partial<Record<ProductListColumnId, ColumnChipDisplay>>;
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
      const showVariants = options?.showVariants ?? false;
      const presentation = resolveProductListRowPresentation(product, showVariants);
      const subline = presentation.attributeSubline;
      const wrapMode = options?.wrapMode ?? "truncate";
      const nameWrapClass = resolveProductListCellTextWrapClass("name", wrapMode);
      const nameTextClass =
        wrapMode === "wrap"
          ? cn("block font-medium", nameWrapClass)
          : cn("block min-w-0 font-medium", nameWrapClass);

      return (
        <div className={productListVariantNameIndentClass(presentation, showVariants)}>
          <span className={nameTextClass}>{product.name?.trim() ? product.name : "—"}</span>
          {subline ? (
            <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
              {subline}
            </span>
          ) : null}
        </div>
      );
    }
    case "default_sku": {
      const showVariants = options?.showVariants ?? false;
      const presentation = resolveProductListRowPresentation(product, showVariants);
      return (
        <span className="font-mono text-muted-foreground">
          {presentation.displaySku ?? "—"}
        </span>
      );
    }
    case "barcode":
      return (
        <span className="font-mono text-muted-foreground">{product.barcode ?? "—"}</span>
      );
    case "classification": {
      const label = classificationLabel(product.classification);
      const column = getColumnDef("classification");
      return renderChipOrText({
        column,
        valueKey: product.classification,
        label,
        textNode: (
          <span
            className={resolveProductListCellTextWrapClass("classification", options?.wrapMode)}
          >
            {label}
          </span>
        ),
        chipDisplay: options?.chipDisplay?.classification,
      });
    }
    case "category_name": {
      const label = product.category_name?.trim() || "—";
      const column = getColumnDef("category_name");
      const valueKey = product.category_name?.trim() || CHIP_DEFAULT_FALLBACK_KEY;
      return renderChipOrText({
        column,
        valueKey,
        label,
        textNode: wrappedTextValue(
          product.category_name,
          resolveProductListCellTextWrapClass("category_name", options?.wrapMode)
        ),
        chipDisplay: options?.chipDisplay?.category_name,
      });
    }
    case "description":
      return wrappedTextValue(
        product.description,
        resolveProductListCellTextWrapClass("description", options?.wrapMode),
        { muted: true, block: true }
      );
    case "base_unit_of_measure": {
      const label = product.base_unit_of_measure;
      const column = getColumnDef("base_unit_of_measure");
      return renderChipOrText({
        column,
        valueKey: label,
        label,
        textNode: <span className="font-mono">{label}</span>,
        chipDisplay: options?.chipDisplay?.base_unit_of_measure,
      });
    }
    case "hsn_sac_code":
      return product.hsn_sac_code ?? "—";
    case "has_variants":
      return formatBoolean("has_variants", product.has_variants, options?.chipDisplay);
    case "default_tax_category": {
      const normalized = normalizeTaxCategory(product.default_tax_category);
      const label = taxCategoryLabel(product.default_tax_category);
      const column = getColumnDef("default_tax_category");
      return renderChipOrText({
        column,
        valueKey: normalized,
        label,
        textNode: (
          <span
            className={resolveProductListCellTextWrapClass(
              "default_tax_category",
              options?.wrapMode
            )}
          >
            {label}
          </span>
        ),
        chipDisplay: options?.chipDisplay?.default_tax_category,
      });
    }
    case "is_active":
      return renderProductListActiveStatus(
        product.is_active,
        options?.chipDisplay?.is_active
      );
    case "is_purchasable":
      return formatBoolean("is_purchasable", product.is_purchasable, options?.chipDisplay);
    case "is_salable":
      return formatBoolean("is_salable", product.is_salable, options?.chipDisplay);
    case "is_returnable":
      return formatBoolean("is_returnable", product.is_returnable, options?.chipDisplay);
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
