"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CardSellingPriceLabel,
  ProductCardBulkCheckbox,
  ProductCardChromeBadges,
  ProductCardFooterRail,
  ProductCardImageWell,
  ProductCardTypeIcon,
} from "@/components/products/product-list-card-parts";
import {
  renderProductListCell,
  resolveProductListCellTextWrapClass,
  renderProductListActiveStatus,
} from "@/components/products/product-list-cells";
import { defaultWrapModeForValueKind, type TextWrapMode } from "@/lib/display/text-wrap";
import type { ColumnChipDisplay } from "@/lib/list-columns/types";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import { buildCardLayoutPlan } from "@/lib/products/card-layout-plan";
import type { ProductCardMetaDisplay, ProductCardOrientation } from "@/lib/products/list-prefs";
import type { ProductListRow } from "@/lib/products/types";
import {
  productListCardHoverClass,
  productListCardShellClass,
  productListCardSurfaceClass,
} from "@/lib/products/list-card-surface";
import { resolveProductListRowPresentation } from "@/lib/products/list-row-presentation";
import {
  productListRowKindBadgeVariant,
  productListRowKindLabel,
} from "@/lib/products/variant-strategy";
import {
  isProductListRowInactive,
  resolveProductListRowActiveStatus,
} from "@/lib/products/list-row-key";
import { cn } from "@/lib/utils";

export type ProductListCardProps = {
  product: ProductListRow;
  columns: ProductListColumnId[];
  columnWrapModes?: Partial<Record<ProductListColumnId, TextWrapMode>>;
  columnChipDisplay?: Partial<Record<ProductListColumnId, ColumnChipDisplay>>;
  orientation?: ProductCardOrientation;
  metaDisplay?: ProductCardMetaDisplay;
  showVariants?: boolean;
  selected: boolean;
  bulkSelected: boolean;
  onSelect: (productId: string, variantId?: string | null) => void;
  onProductHover?: (productId: string, variantId?: string | null) => void;
  onProductPointerEnter?: (productId: string, variantId?: string | null) => void;
  onBulkToggle: (checked: boolean) => void;
  onImageClick?: (product: ProductListRow) => void;
};

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

function SkuHero({
  product,
  showVariants,
  chipDisplay,
  isHorizontal,
  underImage = false,
  skuText,
}: {
  product: ProductListRow;
  showVariants: boolean;
  chipDisplay?: Partial<Record<ProductListColumnId, ColumnChipDisplay>>;
  isHorizontal: boolean;
  underImage?: boolean;
  skuText?: string | null;
}) {
  return (
    <div
      className={cn(
        "max-w-full truncate font-mono font-medium text-muted-foreground",
        underImage
          ? "w-full text-center text-xs sm:text-sm"
          : cn("w-fit", isHorizontal ? "text-sm sm:text-base" : "text-sm")
      )}
    >
      {skuText ??
        renderProductListCell("default_sku", product, { showVariants, chipDisplay })}
    </div>
  );
}

function DetailOverflowMenu({
  product,
  plan,
  showVariants,
  chipDisplay,
}: {
  product: ProductListRow;
  plan: ReturnType<typeof buildCardLayoutPlan>;
  showVariants: boolean;
  chipDisplay?: Partial<Record<ProductListColumnId, ColumnChipDisplay>>;
}) {
  if (plan.detailOverflow.length === 0) return null;

  return (
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
              <span className="text-sm font-medium">
                {getColumnDef(field.columnId).chipEligible
                  ? renderProductListCell(field.columnId, product, {
                      showVariants,
                      chipDisplay,
                    })
                  : field.value}
              </span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Structured detail card — vertical stack or horizontal catalog row. */
export function ProductListCompactCardV2({
  product,
  columns,
  columnWrapModes,
  columnChipDisplay,
  orientation = "vertical",
  metaDisplay = "labels",
  showVariants = false,
  selected,
  bulkSelected,
  onSelect,
  onProductHover,
  onProductPointerEnter,
  onBulkToggle,
  onImageClick,
}: ProductListCardProps) {
  const isHorizontal = orientation === "horizontal";
  const presentation = resolveProductListRowPresentation(product, showVariants);
  const rowInactive = isProductListRowInactive(product, showVariants);
  const rowActive = resolveProductListRowActiveStatus(product, showVariants);
  const plan = buildCardLayoutPlan(columns, product, showVariants, { rowActive });

  const hasLowerRegion =
    !isHorizontal &&
    (plan.regions.metrics ||
      plan.regions.details ||
      plan.regions.flags ||
      plan.regions.meta);

  const nameWrapMode =
    columnWrapModes?.name ??
    getColumnDef("name").defaultWrapMode ??
    defaultWrapModeForValueKind("text", "card");
  const nameWrapClass = resolveProductListCellTextWrapClass(
    "name",
    columnWrapModes?.name,
    "card"
  );

  const variantSkuText =
    presentation.isExpandedVariantRow && plan.hero.variantSkuLine
      ? plan.hero.variantSkuLine
      : null;
  const showMasterSkuSubline =
    !presentation.isExpandedVariantRow &&
    plan.regions.heroSku &&
    Boolean(plan.hero.heroSkuLabel);
  const showSkuSublineUnderName = Boolean(variantSkuText) || showMasterSkuSubline;

  const descriptionBlock = plan.regions.description ? (
    <p
      className={cn(
        "text-xs leading-relaxed text-muted-foreground",
        isHorizontal ? "line-clamp-2" : undefined,
        resolveProductListCellTextWrapClass("description", columnWrapModes?.description, "card")
      )}
    >
      {product.description}
    </p>
  ) : null;

  const heroSublineUnderName = showSkuSublineUnderName ? (
    <SkuHero
      product={product}
      showVariants={showVariants}
      chipDisplay={columnChipDisplay}
      isHorizontal={isHorizontal}
      skuText={variantSkuText}
    />
  ) : isHorizontal ? (
    descriptionBlock
  ) : null;

  const showVariantBadge = presentation.isExpandedVariantRow;
  const showStatusBadge = plan.chrome.showStatus;
  const hasChromeBadges = showVariantBadge || showStatusBadge;

  const cardSurfaceClass = productListCardSurfaceClass(presentation, selected);

  const chromeBadges = (
    <>
      {showVariantBadge ? (
        <Badge variant={productListRowKindBadgeVariant("variant")} className="shrink-0">
          {productListRowKindLabel("variant")}
        </Badge>
      ) : null}
      {showStatusBadge ? (
        <div onClick={(event) => event.stopPropagation()}>
          {renderProductListActiveStatus(rowActive, columnChipDisplay?.is_active)}
        </div>
      ) : null}
    </>
  );

  const heroBody = (
    <div className="flex min-w-0 flex-1 items-start gap-2">
      <ProductCardTypeIcon />
      <div
        className={cn(
          "min-w-0 flex-1 space-y-1 overflow-hidden",
          isHorizontal && "pr-1 sm:pr-1.5"
        )}
      >
        <div className="flex min-w-0 items-start gap-2">
          {plan.hero.showTitle ? (
            <p
              className={cn(
                "min-w-0 flex-1 font-semibold leading-tight text-foreground",
                isHorizontal ? "text-sm sm:text-base" : "text-base",
                nameWrapClass
              )}
              title={
                nameWrapMode === "truncate" ? product.name?.trim() || undefined : undefined
              }
            >
              {product.name?.trim() || "—"}
            </p>
          ) : (
            <span className="min-w-0 flex-1" />
          )}
          {hasChromeBadges ? (
            <ProductCardChromeBadges className="shrink-0">{chromeBadges}</ProductCardChromeBadges>
          ) : null}
        </div>

        {heroSublineUnderName}

        {plan.hero.attributeSubline ? (
          <p className="truncate text-xs text-muted-foreground">{plan.hero.attributeSubline}</p>
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

        {!isHorizontal ? descriptionBlock : null}

        {plan.regions.footerRail ? (
          <ProductCardFooterRail items={plan.footerRail} metaDisplay={metaDisplay} />
        ) : null}
      </div>
    </div>
  );

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
        "relative w-full min-w-0 cursor-pointer overflow-hidden text-left",
        productListCardShellClass,
        productListCardHoverClass,
        cardSurfaceClass,
        isHorizontal
          ? "flex items-stretch gap-3 p-3 sm:gap-4 sm:p-4"
          : "flex min-h-[7.5rem] flex-col p-3 sm:p-4",
        rowInactive && "opacity-50",
        !hasLowerRegion && !isHorizontal && "justify-between"
      )}
    >
      <ProductCardBulkCheckbox
        product={product}
        bulkSelected={bulkSelected}
        onBulkToggle={onBulkToggle}
      />
      <div className={cn("flex gap-3", isHorizontal ? "min-w-0 flex-1 items-stretch" : "flex-col")}>
        <div className={cn("flex min-w-0 gap-3", isHorizontal ? "flex-1" : "flex-row")}>
          {plan.hero.showImage ? (
            <div
              className={cn(
                "flex shrink-0 flex-col gap-1.5",
                isHorizontal && "w-[5.5rem] sm:w-24"
              )}
            >
              <ProductCardImageWell
                product={product}
                onImageClick={onImageClick}
                size={isHorizontal ? "lg" : "md"}
              />
            </div>
          ) : null}
          {heroBody}
        </div>
      </div>

      {!isHorizontal && plan.regions.metrics ? (
        <div
          className={cn(
            "mt-3 grid gap-2 border-t border-border/60 pt-3",
            plan.metrics.length === 1 ? "grid-cols-1" : "grid-cols-3"
          )}
        >
          {plan.metrics.map((metric) => (
            <div key={metric.columnId} className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">{metric.label}</p>
              {metric.columnId === "selling_price" ? (
                <CardSellingPriceLabel
                  amount={metric.value}
                  uom={metric.unitSuffix}
                  size="sm"
                />
              ) : (
                <p className="truncate text-sm font-semibold tabular-nums text-foreground">
                  {metric.value}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : null}

      {!isHorizontal && plan.regions.details ? (
        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/60 pt-2 text-xs">
          {plan.details.map((field) => (
            <div key={field.columnId} className="contents">
              <dt className="truncate text-muted-foreground">{field.label}</dt>
              <dd className="truncate font-medium text-foreground">
                {getColumnDef(field.columnId).chipEligible
                  ? renderProductListCell(field.columnId, product, {
                      showVariants,
                      chipDisplay: columnChipDisplay,
                    })
                  : field.value}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}

      <DetailOverflowMenu
        product={product}
        plan={plan}
        showVariants={showVariants}
        chipDisplay={columnChipDisplay}
      />

      {!isHorizontal && plan.regions.flags ? (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2">
          {plan.flags.map((flag) =>
            getColumnDef(flag.columnId).chipEligible &&
            columnChipDisplay?.[flag.columnId]?.mode === "chip" ? (
              <span key={flag.columnId}>
                {renderProductListCell(flag.columnId, product, {
                  showVariants,
                  chipDisplay: columnChipDisplay,
                })}
              </span>
            ) : (
              <FlagToken key={flag.columnId} label={flag.label} enabled={flag.enabled} />
            )
          )}
        </div>
      ) : null}

      {!isHorizontal && plan.regions.meta ? (
        <footer className="mt-auto pt-2 text-[11px] leading-relaxed text-muted-foreground">
          {plan.metaLine}
        </footer>
      ) : null}
    </article>
  );
}
