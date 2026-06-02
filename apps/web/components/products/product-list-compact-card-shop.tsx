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
import { resolveProductListCellTextWrapClass } from "@/components/products/product-list-cells";
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
  onSelect: (productId: string) => void;
  onBulkToggle: (checked: boolean) => void;
  onImageClick?: (product: ProductListRow) => void;
};

function ShopProductImage({
  product,
  showImage,
  onImageClick,
}: {
  product: ProductListRow;
  showImage: boolean;
  onImageClick?: (product: ProductListRow) => void;
}) {
  if (!showImage) return null;

  const imageClass =
    "h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]";

  const placeholder = (
    <div className="flex h-full w-full items-center justify-center bg-muted/50 text-muted-foreground">
      <Package className="h-10 w-10 opacity-40" strokeWidth={1.25} />
    </div>
  );

  if (product.image_url && onImageClick) {
    return (
      <button
        type="button"
        className="block h-full w-full cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        onClick={(event) => {
          event.stopPropagation();
          onImageClick(product);
        }}
        aria-label={`View images for ${product.name}`}
      >
        <img src={product.image_url} alt="" className={imageClass} loading="lazy" />
      </button>
    );
  }

  if (product.image_url) {
    return <img src={product.image_url} alt="" className={imageClass} loading="lazy" />;
  }

  return placeholder;
}

function StockBadge({
  label,
  status,
}: {
  label: string;
  status: "in_stock" | "low_stock" | "out_of_stock";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        status === "in_stock" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
        status === "low_stock" && "bg-amber-500/15 text-amber-800 dark:text-amber-400",
        status === "out_of_stock" && "bg-muted text-muted-foreground"
      )}
    >
      {label}
    </span>
  );
}

export function ProductListCompactCardShop({
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
  const { shop } = plan;

  const hasPrice = shop.showSellingPrice && shop.sellingPrice;
  const hasCompare = shop.showComparePrice && shop.comparePrice;
  const showImageWell = plan.hero.showImage;
  const secondaryFields = [...plan.details, ...plan.detailOverflow];

  return (
    <article
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
        "group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-xl border border-border/80 bg-card text-left shadow-sm transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-border hover:shadow-md",
        presentation.isExpandedVariantRow && "border-dashed bg-muted/20",
        rowInactive && "opacity-60",
        selected && "border-primary/60 ring-2 ring-primary/25"
      )}
    >
      {showImageWell ? (
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted/30 sm:aspect-square">
          <ShopProductImage
            product={product}
            showImage={showImageWell}
            onImageClick={onImageClick}
          />

          <div
            className="absolute left-2 top-2 z-10"
            onClick={(event) => event.stopPropagation()}
          >
            <Checkbox
              checked={bulkSelected}
              onCheckedChange={(checked) => onBulkToggle(checked === true)}
              className="h-4 w-4 border-background/80 bg-background/90 shadow-sm backdrop-blur-sm data-[state=checked]:bg-primary"
              aria-label={`Select ${product.name}`}
            />
          </div>

          <div className="absolute right-2 top-2 z-10 flex max-w-[55%] flex-col items-end gap-1">
            {presentation.isExpandedVariantRow ? (
              <Badge
                variant={productListRowKindBadgeVariant("variant")}
                className="shrink-0 text-[10px] shadow-sm"
              >
                {productListRowKindLabel("variant")}
              </Badge>
            ) : presentation.showHasVariantsIndicator ? (
              <Badge
                variant={productListRowKindBadgeVariant("style")}
                className="shrink-0 text-[10px] shadow-sm"
              >
                {productListHasVariantsBadgeLabel()}
              </Badge>
            ) : null}
            {plan.chrome.showStatus && !rowActive ? (
              <Badge variant="locked" className="text-[10px] shadow-sm">
                Inactive
              </Badge>
            ) : null}
          </div>

          {shop.showStock && shop.stockLabel && shop.stockStatus ? (
            <div className="absolute bottom-2 left-2 z-10">
              <StockBadge label={shop.stockLabel} status={shop.stockStatus} />
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2"
          onClick={(event) => event.stopPropagation()}
        >
          <Checkbox
            checked={bulkSelected}
            onCheckedChange={(checked) => onBulkToggle(checked === true)}
            aria-label={`Select ${product.name}`}
          />
          {plan.chrome.showStatus && !rowActive ? (
            <Badge variant="locked" className="text-[10px]">
              Inactive
            </Badge>
          ) : null}
        </div>
      )}

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {shop.showCategory && shop.category ? (
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {shop.category}
          </p>
        ) : null}

        {plan.hero.showTitle ? (
          <h3
            className={cn(
              "line-clamp-2 text-sm font-medium leading-snug text-foreground",
              resolveProductListCellTextWrapClass("name", columnWrapModes?.name, "card")
            )}
          >
            {product.name?.trim() || "—"}
          </h3>
        ) : null}

        {plan.hero.attributeSubline ? (
          <p className="line-clamp-1 text-xs text-muted-foreground">{plan.hero.attributeSubline}</p>
        ) : null}

        {shop.showSku && shop.skuLine ? (
          <p className="truncate font-mono text-[11px] text-muted-foreground/90">{shop.skuLine}</p>
        ) : null}

        {plan.regions.description ? (
          <p
            className={cn(
              "line-clamp-2 text-xs text-muted-foreground",
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

        <div className="mt-auto space-y-2 pt-1">
          {hasPrice || hasCompare ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {hasPrice ? (
                <span className="text-lg font-semibold tabular-nums tracking-tight text-foreground">
                  {shop.sellingPrice}
                </span>
              ) : null}
              {hasCompare ? (
                <span className="text-xs tabular-nums text-muted-foreground line-through">
                  {shop.comparePrice}
                </span>
              ) : null}
            </div>
          ) : null}

          {!showImageWell && shop.showStock && shop.stockLabel && shop.stockStatus ? (
            <StockBadge label={shop.stockLabel} status={shop.stockStatus} />
          ) : null}

          {plan.regions.flags ? (
            <p className="line-clamp-2 text-[11px] text-muted-foreground">
              {plan.flags.map((flag, index) => (
                <span key={flag.columnId}>
                  {index > 0 ? " · " : null}
                  {flag.enabled ? flag.label : `Not ${flag.label.toLowerCase()}`}
                </span>
              ))}
            </p>
          ) : null}

          {plan.regions.meta ? (
            <p className="truncate text-[10px] text-muted-foreground/80">{plan.metaLine}</p>
          ) : null}

          {secondaryFields.length > 0 ? (
            <div onClick={(event) => event.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-full px-0 text-xs text-muted-foreground hover:text-foreground"
                  >
                    View details
                    {secondaryFields.length > 1 ? ` (${secondaryFields.length})` : ""}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-w-xs">
                  {secondaryFields.map((field) => (
                    <DropdownMenuItem
                      key={field.columnId}
                      className="flex flex-col items-start gap-0.5"
                    >
                      <span className="text-[11px] text-muted-foreground">{field.label}</span>
                      <span className="text-sm font-medium">{field.value}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
