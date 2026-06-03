"use client";

import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  resolveProductListCellTextWrapClass,
  renderProductListActiveStatus,
} from "@/components/products/product-list-cells";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import { buildCardLayoutPlan } from "@/lib/products/card-layout-plan";
import type { ProductListRow } from "@/lib/products/types";
import { resolveProductListRowPresentation } from "@/lib/products/list-row-presentation";
import {
  productListHasVariantsBadgeLabel,
  productListRowKindBadgeVariant,
  productListRowKindLabel,
} from "@/lib/products/variant-strategy";
import {
  isProductListRowInactive,
  resolveProductListRowActiveStatus,
} from "@/lib/products/list-row-key";
import { cn } from "@/lib/utils";

type CardProps = {
  product: ProductListRow;
  columns: ProductListColumnId[];
  columnWrapModes?: Partial<Record<ProductListColumnId, TextWrapMode>>;
  showVariants?: boolean;
  selected: boolean;
  bulkSelected: boolean;
  onSelect: (productId: string, variantId?: string | null) => void;
  onBulkToggle: (checked: boolean) => void;
  onImageClick?: (product: ProductListRow) => void;
};

function CardImage({
  product,
  onImageClick,
}: {
  product: ProductListRow;
  onImageClick?: (product: ProductListRow) => void;
}) {
  const thumbClass =
    "h-14 w-14 rounded-lg border border-border object-cover bg-muted sm:h-16 sm:w-16";

  if (product.image_url && onImageClick) {
    return (
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
        <img src={product.image_url} alt="" className={thumbClass} loading="lazy" />
      </span>
    );
  }

  if (product.image_url) {
    return <img src={product.image_url} alt="" className={thumbClass} loading="lazy" />;
  }

  return (
    <span
      className="inline-flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-border bg-muted/60 text-muted-foreground sm:h-16 sm:w-16"
      aria-hidden
    >
      <Package className="h-5 w-5" />
    </span>
  );
}

function FlagToken({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <span
      className={cn(
        "text-xs",
        enabled ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
      )}
    >
      {enabled ? "✓" : "—"} {label}
    </span>
  );
}

/** Structured regional card layout (preview / comparison). */
export function ProductListCompactCardV2({
  product,
  columns,
  columnWrapModes,
  showVariants = false,
  selected,
  bulkSelected,
  onSelect,
  onBulkToggle,
  onImageClick,
}: CardProps) {
  const presentation = resolveProductListRowPresentation(product, showVariants);
  const rowInactive = isProductListRowInactive(product, showVariants);
  const rowActive = resolveProductListRowActiveStatus(product, showVariants);
  const plan = buildCardLayoutPlan(columns, product, showVariants, { rowActive });

  const hasLowerRegion =
    plan.regions.metrics ||
    plan.regions.details ||
    plan.regions.flags ||
    plan.regions.meta;

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(product.id, product.variant_id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(product.id, product.variant_id);
        }
      }}
      className={cn(
        "surface-panel flex min-h-[7.5rem] w-full cursor-pointer flex-col rounded-xl p-3 text-left transition-colors duration-200 sm:p-4",
        "hover:border-primary/30 hover:bg-accent/20",
        presentation.isExpandedVariantRow &&
          "border border-dashed border-border/80 bg-muted/25 hover:bg-muted/35",
        presentation.isStyleRow && "bg-background",
        rowInactive && "opacity-50",
        selected && "border-primary/50 bg-primary/5 ring-1 ring-primary/20",
        !hasLowerRegion && "justify-between"
      )}
    >
      <header className="mb-2 flex items-center justify-between gap-2">
        <Checkbox
          checked={bulkSelected}
          onCheckedChange={(checked) => onBulkToggle(checked === true)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Select ${product.name}`}
        />
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {presentation.isExpandedVariantRow ? (
            <Badge variant={productListRowKindBadgeVariant("variant")} className="shrink-0">
              {productListRowKindLabel("variant")}
            </Badge>
          ) : presentation.showHasVariantsIndicator ? (
            <Badge variant={productListRowKindBadgeVariant("style")} className="shrink-0">
              {productListHasVariantsBadgeLabel()}
            </Badge>
          ) : null}
          {plan.chrome.showStatus ? (
            <div onClick={(event) => event.stopPropagation()}>
              {renderProductListActiveStatus(plan.chrome.statusActive)}
            </div>
          ) : null}
        </div>
      </header>

      <div className="flex gap-3">
        {plan.hero.showImage ? (
          <div className="shrink-0">
            <CardImage product={product} onImageClick={onImageClick} />
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-1">
          {plan.hero.showTitle ? (
            <p
              className={cn(
                "text-base font-semibold leading-tight text-foreground",
                resolveProductListCellTextWrapClass("name", columnWrapModes?.name, "card")
              )}
            >
              {product.name?.trim() || "—"}
            </p>
          ) : null}

          {plan.hero.attributeSubline ? (
            <p className="truncate text-xs text-muted-foreground">{plan.hero.attributeSubline}</p>
          ) : null}

          {plan.hero.variantSkuLine ? (
            <p className="truncate font-mono text-xs text-muted-foreground">
              {plan.hero.variantSkuLine}
            </p>
          ) : null}

          {plan.regions.heroContext ? (
            <p className="truncate text-xs text-muted-foreground">
              {plan.hero.contextSegments.map((segment, index) => (
                <span key={index}>
                  {index > 0 ? <span aria-hidden> · </span> : null}
                  <span className={segment.mono ? "font-mono" : undefined}>{segment.text}</span>
                </span>
              ))}
              {plan.hero.contextOverflowCount > 0 ? (
                <span className="text-muted-foreground/80">
                  {" "}
                  · +{plan.hero.contextOverflowCount} more
                </span>
              ) : null}
            </p>
          ) : null}

          {plan.regions.description ? (
            <p
              className={cn(
                "text-xs text-muted-foreground",
                resolveProductListCellTextWrapClass(
                  "description",
                  columnWrapModes?.description,
                  "card"
                )
              )}
            >
              {product.description}
            </p>
          ) : null}
        </div>
      </div>

      {plan.regions.metrics ? (
        <div
          className={cn(
            "mt-3 grid gap-2 border-t border-border/60 pt-3",
            plan.metrics.length === 1 ? "grid-cols-1" : "grid-cols-3"
          )}
        >
          {plan.metrics.map((metric) => (
            <div key={metric.columnId} className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">{metric.label}</p>
              <p className="truncate text-sm font-semibold tabular-nums text-foreground">
                {metric.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}

      {plan.regions.details ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs">
          {plan.details.map((field) => (
            <div key={field.columnId} className="contents">
              <dt className="truncate text-muted-foreground">{field.label}</dt>
              <dd className="truncate font-medium text-foreground">{field.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {plan.detailOverflow.length > 0 ? (
        <div className="mt-1 flex justify-end" onClick={(event) => event.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs">
                +{plan.detailOverflow.length} more fields
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-w-xs">
              {plan.detailOverflow.map((field) => (
                <DropdownMenuItem key={field.columnId} className="flex flex-col items-start gap-0.5">
                  <span className="text-[11px] text-muted-foreground">{field.label}</span>
                  <span className="text-sm font-medium">{field.value}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : null}

      {plan.regions.flags ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2">
          {plan.flags.map((flag) => (
            <FlagToken key={flag.columnId} label={flag.label} enabled={flag.enabled} />
          ))}
        </div>
      ) : null}

      {plan.regions.meta ? (
        <footer className="mt-auto pt-2 text-[11px] leading-relaxed text-muted-foreground">
          {plan.metaLine}
        </footer>
      ) : null}
    </article>
  );
}
