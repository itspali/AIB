"use client";

import type { ReactNode } from "react";
import {
  FolderOpen,
  LayoutGrid,
  Package,
  Tag,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { CardLayoutFooterItem } from "@/lib/products/card-layout-plan";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductCardMetaDisplay } from "@/lib/products/list-prefs";
import type { ProductListRow } from "@/lib/products/types";
import { cn } from "@/lib/utils";

/** High-contrast bulk-select checkbox for card corner placement. */
export const productCardBulkCheckboxClass =
  "h-4 w-4 border-foreground/45 bg-background shadow-md ring-2 ring-background/95 data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground";

export const productCardBulkCheckboxPositionClass =
  "absolute left-2 top-2 z-20 sm:left-3 sm:top-3";

type ProductCardBulkCheckboxProps = {
  product: ProductListRow;
  bulkSelected: boolean;
  onBulkToggle: (checked: boolean) => void;
};

export function ProductCardBulkCheckbox({
  product,
  bulkSelected,
  onBulkToggle,
}: ProductCardBulkCheckboxProps) {
  return (
    <div
      className={productCardBulkCheckboxPositionClass}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Checkbox
        checked={bulkSelected}
        onCheckedChange={(checked) => onBulkToggle(checked === true)}
        className={productCardBulkCheckboxClass}
        aria-label={`Select ${product.name}`}
      />
    </div>
  );
}

const FOOTER_ICON: Partial<Record<ProductListColumnId, LucideIcon>> = {
  default_sku: Tag,
  has_variants: LayoutGrid,
  stock_on_hand: Warehouse,
  category_name: FolderOpen,
};

type CardImageProps = {
  product: ProductListRow;
  onImageClick?: (product: ProductListRow) => void;
  size?: "md" | "lg";
};

export function ProductCardImageWell({
  product,
  onImageClick,
  size = "md",
}: CardImageProps) {
  const frameClass =
    size === "lg"
      ? "h-[5.5rem] w-[5.5rem] sm:h-24 sm:w-24"
      : "h-14 w-14 sm:h-16 sm:w-16";
  const imgClass = cn("rounded-lg border border-border object-cover bg-muted", frameClass);

  const imageNode = product.image_url ? (
    onImageClick ? (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onImageClick(product);
        }}
        className="block h-full w-full cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label={`View images for ${product.name}`}
      >
        <img src={product.image_url} alt="" className={cn(imgClass, "h-full w-full")} loading="lazy" />
      </button>
    ) : (
      <img src={product.image_url} alt="" className={imgClass} loading="lazy" />
    )
  ) : (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-dashed border-border bg-primary/5 text-muted-foreground",
        frameClass
      )}
      aria-hidden
    >
      <Package className={size === "lg" ? "h-7 w-7" : "h-5 w-5"} />
    </span>
  );

  return <div className={cn("relative shrink-0", frameClass)}>{imageNode}</div>;
}

export function ProductCardTypeIcon({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary",
        className
      )}
      aria-hidden
    >
      <Package className="h-3.5 w-3.5" />
    </span>
  );
}

type FooterRailProps = {
  items: CardLayoutFooterItem[];
  metaDisplay: ProductCardMetaDisplay;
};

export function ProductCardFooterRail({
  items,
  metaDisplay,
}: FooterRailProps) {
  if (!items.length) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs text-muted-foreground">
      {items.map((item, index) => {
        const Icon = FOOTER_ICON[item.columnId] ?? Tag;
        const iconOnly = metaDisplay === "icons";

        return (
          <span key={item.columnId} className="inline-flex min-w-0 items-center gap-1.5">
            {index > 0 ? (
              <span className="mr-1 hidden h-3 w-px bg-border sm:inline-block" aria-hidden />
            ) : null}
            <Icon className="h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden />
            {iconOnly ? (
              <span
                className={cn(
                  "truncate font-medium text-foreground",
                  item.columnId === "default_sku" && "font-mono text-[11px]"
                )}
                title={`${item.label}: ${item.value}`}
              >
                {item.value}
              </span>
            ) : (
              <span className="truncate">
                <span className="text-muted-foreground">{item.label}:</span>{" "}
                <span
                  className={cn(
                    "font-medium text-foreground",
                    item.columnId === "default_sku" && "font-mono"
                  )}
                >
                  {item.value}
                </span>
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}

export function ProductCardChromeBadges({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center justify-end gap-1.5", className)}>
      {children}
    </div>
  );
}
