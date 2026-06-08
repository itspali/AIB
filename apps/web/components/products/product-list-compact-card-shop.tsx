"use client";

import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  CardMrpLabel,
  CardSellingPriceLabel,
  ProductCardBulkCheckbox,
} from "@/components/products/product-list-card-parts";
import {
  renderProductListActiveStatus,
  resolveProductListCellTextWrapClass,
} from "@/components/products/product-list-cells";
import type { TextWrapMode } from "@/lib/display/text-wrap";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import { buildCardLayoutPlan } from "@/lib/products/card-layout-plan";
import type { ProductListRow } from "@/lib/products/types";
import {
  productListCardHoverClass,
  productListCardShellClass,
  productListCardSurfaceClass,
} from "@/lib/products/list-card-surface";
import { resolveProductListRowPresentation } from "@/lib/products/list-row-presentation";
import {
  productListHasVariantsBadgeLabel,
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
  columnChipDisplay?: Partial<Record<ProductListColumnId, ColumnChipDisplay>>;
  showVariants?: boolean;
  selected: boolean;
  bulkSelected: boolean;
  onSelect: (productId: string, variantId?: string | null) => void;
  onProductHover?: (productId: string, variantId?: string | null) => void;
  onProductPointerEnter?: (productId: string, variantId?: string | null) => void;
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

function CardStockRow({
  showStock,
  stockLabel,
  stockStatus,
  trailingLabel,
}: {
  showStock: boolean;
  stockLabel: string | null;
  stockStatus: "in_stock" | "low_stock" | "out_of_stock" | null;
  trailingLabel?: string | null;
}) {
  const hasStock = showStock && stockLabel && stockStatus;
  if (!hasStock && !trailingLabel) return null;

  return (
    <div className="flex w-full items-center justify-between gap-2">
      {hasStock ? <StockBadge label={stockLabel} status={stockStatus} /> : <span />}
      {trailingLabel ? (
        <Badge variant="completed" className="shrink-0 text-[10px] shadow-sm">
          {trailingLabel}
        </Badge>
      ) : null}
    </div>
  );
}

function VariantsIndicatorBadge({
  show,
  variantCount,
}: {
  show: boolean;
  variantCount?: number | null;
}) {
  if (!show) return null;

  return (
    <p className="text-xs font-medium text-muted-foreground">
      {productListHasVariantsBadgeLabel(variantCount)}
    </p>
  );
}

export function ProductListCompactCardShop({
  product,
  columns,
  columnWrapModes,
  columnChipDisplay,
  showVariants = false,
  selected,
  bulkSelected,
  onSelect,
  onProductHover,
  onProductPointerEnter,
  onBulkToggle,
  onImageClick,
}: CardProps) {
  const presentation = resolveProductListRowPresentation(product, showVariants);
  const rowInactive = isProductListRowInactive(product, showVariants);
  const rowActive = resolveProductListRowActiveStatus(product, showVariants);
  const plan = buildCardLayoutPlan(columns, product, showVariants, { rowActive });
  const { shop } = plan;

  const hasPrice = shop.showSellingPrice && shop.sellingPriceAmount;
  const hasMrp = shop.showMrp && shop.mrpPrice;
  const showImageWell = plan.hero.showImage;
  const secondaryFields = [...plan.details, ...plan.detailOverflow];
  const stockRowTrailingLabel = presentation.isExpandedVariantRow
    ? productListRowKindLabel("variant")
    : null;

  const cardSurfaceClass = productListCardSurfaceClass(presentation, selected);

  return (
    <article
      data-row-kind={presentation.kind}
      role="button"
      tabIndex={0}
      onClick={() => onSelect(product.id, product.variant_id)}
      onMouseEnter={() => onProductHover?.(product.id, product.variant_id)}
      onPointerEnter={() => onProductPointerEnter?.(product.id, product.variant_id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(product.id, product.variant_id);
        }
      }}
      className={cn(
        "group relative flex h-full w-full cursor-pointer flex-col overflow-hidden text-left",
        productListCardShellClass,
        productListCardHoverClass,
        cardSurfaceClass,
        rowInactive && "opacity-60"
      )}
    >
      <ProductCardBulkCheckbox
        product={product}
        bulkSelected={bulkSelected}
        onBulkToggle={onBulkToggle}
      />
      {showImageWell ? (
        <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted/40 sm:aspect-square">
          <ShopProductImage
            product={product}
            showImage={showImageWell}
            onImageClick={onImageClick}
          />

          <div className="absolute right-2 top-2 z-10 flex max-w-[55%] flex-col items-end gap-1">
            {plan.chrome.showStatus ? (
              renderProductListActiveStatus(rowActive, columnChipDisplay?.is_active)
            ) : null}
          </div>

          {(shop.showStock && shop.stockLabel && shop.stockStatus) || stockRowTrailingLabel ? (
            <div className="absolute bottom-2 left-2 right-2 z-10">
              <CardStockRow
                showStock={shop.showStock}
                stockLabel={shop.stockLabel}
                stockStatus={shop.stockStatus}
                trailingLabel={stockRowTrailingLabel}
              />
            </div>
          ) : null}
        </div>
      ) : plan.chrome.showStatus ? (
        <div
          className="flex items-center justify-end gap-2 border-b border-border/60 px-3 py-2"
          onClick={(event) => event.stopPropagation()}
        >
          {renderProductListActiveStatus(rowActive, columnChipDisplay?.is_active)}
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        {shop.showCategory && shop.category ? (
          <p className="truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            {shop.category}
          </p>
        ) : null}

        {plan.hero.showTitle ? (
          <h3
            className={cn(
              "min-w-0 text-sm font-medium leading-snug text-foreground",
              resolveProductListCellTextWrapClass("name", columnWrapModes?.name, "card")
            )}
          >
            {product.name?.trim() || "—"}
          </h3>
        ) : null}

        <VariantsIndicatorBadge
          show={presentation.showHasVariantsIndicator}
          variantCount={product.sellable_variant_count}
        />

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
          {hasPrice || hasMrp ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              {hasPrice ? (
                <CardSellingPriceLabel
                  amount={shop.sellingPriceAmount!}
                  uom={shop.sellingPriceUom}
                />
              ) : null}
              {hasMrp ? <CardMrpLabel amount={shop.mrpPrice!} /> : null}
            </div>
          ) : null}

          {!showImageWell ? (
            <CardStockRow
              showStock={shop.showStock}
              stockLabel={shop.stockLabel}
              stockStatus={shop.stockStatus}
              trailingLabel={stockRowTrailingLabel}
            />
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
