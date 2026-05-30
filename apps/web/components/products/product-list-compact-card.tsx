"use client";

import { Package } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  buildCompactCardSubline,
  formatCompactCardSubline,
} from "@/lib/products/compact-card-subline";
import { formatCurrency, formatDate } from "@/lib/dashboard/format";
import { classificationLabel } from "@/lib/products/classification-labels";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import { textWrapModeClassName } from "@/lib/display/text-wrap";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import { getColumnDef } from "@/lib/products/list-columns";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import type { ProductListRow } from "@/lib/products/types";
import {
  productListRowKindBadgeVariant,
  productListRowKindLabel,
  resolveProductListRowKind,
} from "@/lib/products/variant-strategy";
import { cn } from "@/lib/utils";

const HEADER_COLUMNS = new Set<ProductListColumnId>([
  "image",
  "name",
  "description",
  "default_sku",
  "is_active",
]);

function MetaChip({
  label,
  children,
  variant = "locked",
}: {
  label: string;
  children: ReactNode;
  variant?: "completed" | "active" | "action_required" | "locked" | "default";
}) {
  return (
    <Badge variant={variant} className="gap-1 font-normal">
      <span className="font-medium opacity-70">{label}</span>
      <span>{children}</span>
    </Badge>
  );
}

function hasDisplayValue(columnId: ProductListColumnId, product: ProductListRow): boolean {
  switch (columnId) {
    case "image":
    case "name":
    case "is_active":
    case "has_variants":
    case "is_purchasable":
    case "is_salable":
    case "is_returnable":
      return true;
    case "default_sku":
      return Boolean(product.style_code?.trim() || product.default_sku?.trim());
    case "barcode":
      return Boolean(product.barcode?.trim());
    case "category_name":
      return Boolean(product.category_name?.trim());
    case "description":
      return Boolean(product.description?.trim());
    case "hsn_sac_code":
      return Boolean(product.hsn_sac_code?.trim());
    case "supplier_name":
      return Boolean(product.supplier_name?.trim());
    case "selling_price":
      return Boolean(product.selling_price?.trim()) && Number.isFinite(Number(product.selling_price));
    case "purchase_price":
      return Boolean(product.purchase_price?.trim()) && Number.isFinite(Number(product.purchase_price));
    case "base_unit_of_measure":
    case "classification":
    case "default_tax_category":
    case "created_at":
    case "updated_at":
      return true;
    default:
      return false;
  }
}

function renderCompactChip(columnId: ProductListColumnId, product: ProductListRow): ReactNode {
  switch (columnId) {
    case "classification":
      return (
        <Badge variant="active" title={getColumnDef(columnId).label}>
          {classificationLabel(product.classification)}
        </Badge>
      );
    case "category_name":
      return (
        <Badge variant="active" title={getColumnDef(columnId).label}>
          {product.category_name}
        </Badge>
      );
    case "base_unit_of_measure":
      return (
        <MetaChip label="UOM" variant="locked">
          <span className="font-mono">{product.base_unit_of_measure}</span>
        </MetaChip>
      );
    case "default_tax_category":
      return (
        <MetaChip label="Tax" variant="locked">
          {taxCategoryLabel(product.default_tax_category)}
        </MetaChip>
      );
    case "hsn_sac_code":
      return (
        <MetaChip label="HSN" variant="locked">
          <span className="font-mono">{product.hsn_sac_code}</span>
        </MetaChip>
      );
    case "barcode":
      return (
        <MetaChip label="Barcode" variant="locked">
          <span className="font-mono">{product.barcode}</span>
        </MetaChip>
      );
    case "has_variants":
      return product.has_variants ? <Badge variant="completed">Has variants</Badge> : null;
    case "is_purchasable":
      return product.is_purchasable ? <Badge variant="completed">Purchasable</Badge> : null;
    case "is_salable":
      return product.is_salable ? <Badge variant="completed">Salable</Badge> : null;
    case "is_returnable":
      return product.is_returnable ? <Badge variant="completed">Returnable</Badge> : null;
    case "selling_price":
      return (
        <MetaChip label="Sell" variant="action_required">
          <span className="tabular-nums">{formatCurrency(Number(product.selling_price))}</span>
        </MetaChip>
      );
    case "purchase_price":
      return (
        <MetaChip label="Buy" variant="action_required">
          <span className="tabular-nums">{formatCurrency(Number(product.purchase_price))}</span>
        </MetaChip>
      );
    case "supplier_name":
      return (
        <MetaChip label="Supplier" variant="default">
          {product.supplier_name}
        </MetaChip>
      );
    case "created_at":
      return (
        <MetaChip label="Created" variant="locked">
          <span className="tabular-nums">{formatDate(product.created_at)}</span>
        </MetaChip>
      );
    case "updated_at":
      return (
        <MetaChip label="Updated" variant="locked">
          <span className="tabular-nums">{formatDate(product.updated_at)}</span>
        </MetaChip>
      );
    default:
      return null;
  }
}

type CardProps = {
  product: ProductListRow;
  columns: ProductListColumnId[];
  columnWrapModes?: Partial<Record<ProductListColumnId, TextWrapMode>>;
  selected: boolean;
  bulkSelected: boolean;
  onSelect: (productId: string) => void;
  onBulkToggle: (productId: string, checked: boolean) => void;
  onImageClick?: (product: ProductListRow) => void;
};

export function ProductListCompactCard({
  product,
  columns,
  columnWrapModes,
  selected,
  bulkSelected,
  onSelect,
  onBulkToggle,
  onImageClick,
}: CardProps) {
  const showImage = columns.includes("image");
  const showName = columns.includes("name");
  const showSku = columns.includes("default_sku");
  const showActive = columns.includes("is_active");
  const showDescription =
    columns.includes("description") && Boolean(product.description?.trim());

  const subline = buildCompactCardSubline({ product, showSku, showStatus: showActive });
  const rowKind = resolveProductListRowKind(product, Boolean(product.variant_id));

  const chipColumns = columns.filter(
    (columnId) =>
      !HEADER_COLUMNS.has(columnId) && hasDisplayValue(columnId, product)
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(product.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(product.id);
        }
      }}
      className={cn(
        "surface-panel h-full w-full cursor-pointer rounded-xl p-3 text-left transition-colors duration-200 sm:p-4",
        "hover:border-primary/30 hover:bg-accent/20",
        !product.is_active && "opacity-50",
        selected && "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Checkbox
          checked={bulkSelected}
          onCheckedChange={(checked) => onBulkToggle(product.id, checked === true)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${product.name}`}
        />
      </div>
      <div className="flex h-full gap-3">
        {showImage ? (
          <div className="shrink-0">
            {product.image_url && onImageClick ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onImageClick(product);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onImageClick(product);
                  }
                }}
                className="inline-flex cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`View images for ${product.name}`}
              >
                <img
                  src={product.image_url}
                  alt=""
                  className="h-14 w-14 rounded-lg border border-border object-cover bg-muted sm:h-16 sm:w-16"
                  loading="lazy"
                />
              </span>
            ) : product.image_url ? (
              <img
                src={product.image_url}
                alt=""
                className="h-14 w-14 rounded-lg border border-border object-cover bg-muted sm:h-16 sm:w-16"
                loading="lazy"
              />
            ) : (
              <span
                className="inline-flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border bg-muted/60 text-muted-foreground sm:h-16 sm:w-16"
                aria-hidden
              >
                <Package className="h-5 w-5" />
              </span>
            )}
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-1.5">
          {showName ? (
            <div className="flex flex-wrap items-center gap-2">
              <p
                className={cn(
                  "text-base font-semibold leading-tight text-foreground",
                  textWrapModeClassName(
                    columnWrapModes?.name ?? "truncate",
                    getColumnDef("name").valueKind
                  )
                )}
              >
                {product.name}
              </p>
              <Badge variant={productListRowKindBadgeVariant(rowKind)} className="shrink-0">
                {productListRowKindLabel(rowKind)}
              </Badge>
            </div>
          ) : null}

          {subline ? (
            <p className="truncate text-xs text-muted-foreground">
              {subline.skuPart ? (
                <span className="font-mono">{subline.skuPart}</span>
              ) : null}
              {subline.skuPart && subline.statusPart ? (
                <span aria-hidden="true"> · </span>
              ) : null}
              {subline.statusPart ? (
                <span className={subline.statusActive ? "text-emerald-600 dark:text-emerald-400" : ""}>
                  {subline.statusPart}
                </span>
              ) : null}
              <span className="sr-only">{formatCompactCardSubline(subline)}</span>
            </p>
          ) : null}

          {showDescription ? (
            <p
              className={cn(
                "text-xs text-muted-foreground",
                textWrapModeClassName(
                  columnWrapModes?.description ?? "line-clamp-1",
                  getColumnDef("description").valueKind
                )
              )}
            >
              {product.description}
            </p>
          ) : null}

          {chipColumns.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {chipColumns.map((columnId) => {
                const chip = renderCompactChip(columnId, product);
                if (!chip) return null;
                return <span key={columnId}>{chip}</span>;
              })}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
