"use client";

import type { ReactNode } from "react";
import {
  columnSupportsWrapControl,
  defaultWrapModeForValueKind,
  textWrapModeClassName,
  type TextWrapMode,
} from "@/lib/display/text-wrap";
import { formatDate } from "@/lib/dashboard/format";
import { formatListCurrency, formatListQuantity } from "@/lib/list-columns/format-list-value";
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
import {
  LIST_TABLE_CELL_AMOUNT,
  LIST_TABLE_CELL_CHIP_FALLBACK,
  LIST_TABLE_CELL_COUNT,
  LIST_TABLE_CELL_DATE,
  LIST_TABLE_CELL_PRIMARY,
  LIST_TABLE_CELL_SUBLINE,
} from "@/lib/layout/list-table-chrome";
import { isBlankMatrixDisplayValue } from "@/lib/layout/matrix-blank-value";
import { cn } from "@/lib/utils";
import type { ProductListViewMode } from "@/lib/products/list-prefs";
import { ItemLifecycleStatusDot } from "@/components/products/item-lifecycle-status-dot";
import { ProductListItemImage } from "@/components/products/product-list-item-image";
import { resolveItemListRowLifecycleStatus } from "@/lib/products/item-lifecycle-status";

type ProductListCellSurface = "list" | "matrix";

function isMatrixSurface(surface?: ProductListCellSurface): boolean {
  return surface === "matrix";
}

function listTypography(surface: ProductListCellSurface | undefined, token: string): string | undefined {
  return isMatrixSurface(surface) ? undefined : token;
}

function matrixMutedClass(surface: ProductListCellSurface | undefined, muted?: boolean): string | undefined {
  if (!muted) return undefined;
  if (isMatrixSurface(surface)) return undefined;
  return "text-muted-foreground";
}
function matrixCellEmpty(surface?: ProductListCellSurface): ReactNode {
  return isMatrixSurface(surface) ? null : "—";
}

function formatBooleanText(value: boolean): string {
  return value ? "Yes" : "No";
}

function formatBoolean(
  columnId: ProductListColumnId,
  value: boolean,
  chipDisplay?: Partial<Record<ProductListColumnId, ColumnChipDisplay>>,
  surface?: ProductListCellSurface
): ReactNode {
  const column = getColumnDef(columnId);
  const label = formatBooleanText(value);
  return renderChipOrText({
    column,
    valueKey: booleanValueKey(value),
    label,
    textNode: isMatrixSurface(surface) ? (
      <span>{label}</span>
    ) : (
      <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>
    ),
    chipDisplay: chipDisplay?.[columnId],
  });
}

function formatActiveStatusText(value: boolean, surface?: ProductListCellSurface): ReactNode {
  const label = value ? "Active" : "Inactive";
  return isMatrixSurface(surface) ? (
    <span>{label}</span>
  ) : (
    <span className={LIST_TABLE_CELL_CHIP_FALLBACK}>{label}</span>
  );
}

export function renderProductListActiveStatus(
  value: boolean,
  chipDisplay?: ColumnChipDisplay,
  surface?: ProductListCellSurface
): ReactNode {
  const column = getColumnDef("is_active");
  const label = value ? "Active" : "Inactive";
  return renderChipOrText({
    column,
    valueKey: booleanValueKey(value),
    label,
    textNode: formatActiveStatusText(value, surface),
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
  options?: { muted?: boolean; block?: boolean; surface?: ProductListCellSurface }
): ReactNode {
  if (!value?.trim()) return matrixCellEmpty(options?.surface);
  return (
    <span
      className={cn(
        options?.block && "block",
        matrixMutedClass(options?.surface, options?.muted),
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
  showLifecycleDot?: boolean;
  wrapMode?: TextWrapMode;
  chipDisplay?: Partial<Record<ProductListColumnId, ColumnChipDisplay>>;
  surface?: ProductListCellSurface;
};

export function renderProductListCell(
  columnId: ProductListColumnId,
  product: ProductListRow,
  options?: RenderProductListCellOptions
): ReactNode {
  const surface = options?.surface;

  switch (columnId) {
    case "image":
      return (
        <ProductListItemImage
          product={product}
          onImageClick={options?.onImageClick}
          size="table"
        />
      );
    case "name": {
      const showVariants = options?.showVariants ?? false;
      const presentation = resolveProductListRowPresentation(product, showVariants);
      const subline = presentation.attributeSubline;
      const wrapMode = options?.wrapMode ?? "truncate";
      const nameWrapClass = resolveProductListCellTextWrapClass("name", wrapMode);
      const nameTextClass =
        wrapMode === "wrap"
          ? cn("block min-w-0", listTypography(surface, LIST_TABLE_CELL_PRIMARY), nameWrapClass)
          : cn("block min-w-0", listTypography(surface, LIST_TABLE_CELL_PRIMARY), nameWrapClass);
      const lifecycleStatus = options?.showLifecycleDot
        ? resolveItemListRowLifecycleStatus(product, showVariants)
        : null;

      return (
        <div className={productListVariantNameIndentClass(presentation, showVariants)}>
          <span
            className={cn(
              "flex min-w-0 items-center gap-1.5",
              wrapMode === "wrap" && "flex-wrap"
            )}
          >
            {lifecycleStatus ? (
              <ItemLifecycleStatusDot
                tone={lifecycleStatus.tone}
                label={lifecycleStatus.label}
              />
            ) : null}
            <span className={nameTextClass}>
              {product.name?.trim() ? product.name : matrixCellEmpty(surface)}
            </span>
          </span>
          {subline ? (
            <span
              className={cn(
                isMatrixSurface(surface)
                  ? "matrix-table__subline truncate"
                  : cn("mt-0.5 block truncate font-normal", LIST_TABLE_CELL_SUBLINE)
              )}
            >
              {subline}
            </span>
          ) : null}
        </div>
      );
    }
    case "default_sku": {
      const showVariants = options?.showVariants ?? false;
      const presentation = resolveProductListRowPresentation(product, showVariants);
      const sku = presentation.displaySku;
      return <span>{sku?.trim() ? sku : matrixCellEmpty(surface)}</span>;
    }
    case "barcode":
      return (
        <span>{product.barcode?.trim() ? product.barcode : matrixCellEmpty(surface)}</span>
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
      if (isMatrixSurface(surface) && !product.category_name?.trim()) return null;
      const label = product.category_name?.trim() || "—";
      const column = getColumnDef("category_name");
      const valueKey = product.category_name?.trim() || CHIP_DEFAULT_FALLBACK_KEY;
      return renderChipOrText({
        column,
        valueKey,
        label,
        textNode: wrappedTextValue(
          product.category_name,
          resolveProductListCellTextWrapClass("category_name", options?.wrapMode),
          { surface }
        ),
        chipDisplay: options?.chipDisplay?.category_name,
      });
    }
    case "description":
      return wrappedTextValue(
        product.description,
        resolveProductListCellTextWrapClass("description", options?.wrapMode),
        { muted: true, block: true, surface }
      );
    case "base_unit_of_measure": {
      const label = product.base_unit_of_measure;
      const column = getColumnDef("base_unit_of_measure");
      return renderChipOrText({
        column,
        valueKey: label,
        label,
        textNode: <span>{label}</span>,
        chipDisplay: options?.chipDisplay?.base_unit_of_measure,
      });
    }
    case "hsn_sac_code":
      return product.hsn_sac_code?.trim() ? product.hsn_sac_code : matrixCellEmpty(surface);
    case "has_variants":
      return formatBoolean("has_variants", product.has_variants, options?.chipDisplay, surface);
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
        options?.chipDisplay?.is_active,
        surface
      );
    case "is_purchasable":
      return formatBoolean("is_purchasable", product.is_purchasable, options?.chipDisplay, surface);
    case "is_salable":
      return formatBoolean("is_salable", product.is_salable, options?.chipDisplay, surface);
    case "is_returnable":
      return formatBoolean("is_returnable", product.is_returnable, options?.chipDisplay, surface);
    case "selling_price": {
      const formatted = formatListCurrency(product.selling_price);
      if (isMatrixSurface(surface) && isBlankMatrixDisplayValue(formatted)) return null;
      return (
        <span className={listTypography(surface, LIST_TABLE_CELL_AMOUNT)}>{formatted}</span>
      );
    }
    case "mrp": {
      const formatted = formatListCurrency(product.mrp);
      if (isMatrixSurface(surface) && isBlankMatrixDisplayValue(formatted)) return null;
      return (
        <span className={listTypography(surface, LIST_TABLE_CELL_COUNT)}>{formatted}</span>
      );
    }
    case "purchase_price": {
      const formatted = formatListCurrency(product.purchase_price);
      if (isMatrixSurface(surface) && isBlankMatrixDisplayValue(formatted)) return null;
      return (
        <span className={listTypography(surface, LIST_TABLE_CELL_COUNT)}>{formatted}</span>
      );
    }
    case "supplier_name":
      return wrappedTextValue(
        product.supplier_name,
        resolveProductListCellTextWrapClass("supplier_name", options?.wrapMode),
        { surface }
      );
    case "stock_on_hand": {
      const qty = product.stock_on_hand;
      if (qty == null || qty.trim() === "") return matrixCellEmpty(surface);
      return (
        <span className={listTypography(surface, LIST_TABLE_CELL_COUNT)}>
          {formatListQuantity(qty)}
        </span>
      );
    }
    case "created_at":
      return (
        <span className={listTypography(surface, LIST_TABLE_CELL_DATE)}>
          {formatDate(product.created_at)}
        </span>
      );
    case "updated_at":
      return (
        <span className={listTypography(surface, LIST_TABLE_CELL_DATE)}>
          {formatDate(product.updated_at)}
        </span>
      );
    default:
      return matrixCellEmpty(surface);
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
    return "font-mono text-muted-foreground";
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
