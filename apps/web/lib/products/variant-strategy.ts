export const PRODUCT_VARIANT_STRATEGIES = ["SINGLE_SKU", "MULTI_SKU"] as const;

export type ProductVariantStrategy = (typeof PRODUCT_VARIANT_STRATEGIES)[number];

export function isProductVariantStrategy(value: string): value is ProductVariantStrategy {
  return (PRODUCT_VARIANT_STRATEGIES as readonly string[]).includes(value);
}

export type VariantStrategyChoice = {
  value: ProductVariantStrategy;
  label: string;
  description: string;
};

/** Short intro for the Variant field info popover. */
export const VARIANT_STRATEGY_FIELD_INTRO =
  "Do you track one product code or many (for example each size or color)? This does not mean whether you sell online.";

/** True when the user may pick Single SKU (not when multiple sellable variants already exist). */
export function canSelectSingleVariantStrategy(sellableVariantCount: number): boolean {
  return sellableVariantCount <= 1;
}

/** Labels and guidance for the product editor variant picker. */
export const VARIANT_STRATEGY_CHOICES: VariantStrategyChoice[] = [
  {
    value: "SINGLE_SKU",
    label: "One variant",
    description:
      "One SKU for the whole product. Best when there is only one sellable configuration.",
  },
  {
    value: "MULTI_SKU",
    label: "Multiple variants",
    description:
      "A separate SKU for each configuration (size, color, board type, etc.). Add variants after you save.",
  },
];

/** Compact label for badges and read-only fields (edit / view). */
export function variantStrategyLabel(strategy: ProductVariantStrategy): string {
  switch (strategy) {
    case "SINGLE_SKU":
      return "Single";
    case "MULTI_SKU":
      return "Multiple";
    default:
      return strategy;
  }
}

export type ProductListRowKind = "style" | "variant" | "single";

export function resolveProductListRowKind(
  row: {
    variant_strategy?: ProductVariantStrategy | null;
    has_variants?: boolean;
    variant_id?: string | null;
  },
  showVariants: boolean
): ProductListRowKind {
  const strategy = row.variant_strategy ?? "SINGLE_SKU";

  if (showVariants && row.variant_id) {
    // Expanded list: multi-variant styles emit one row per sellable variant.
    // Also treat legacy rows where has_variants=true but variant_strategy was never migrated.
    if (strategy === "MULTI_SKU" || row.has_variants) {
      return "variant";
    }
    return "single";
  }

  if (strategy === "MULTI_SKU") {
    return "style";
  }
  return "single";
}

export function productListRowKindLabel(kind: ProductListRowKind): string {
  switch (kind) {
    case "style":
      return "Product";
    case "variant":
      return "Variant";
    case "single":
      return "Single SKU";
  }
}

export function shouldShowProductListRowKindBadge(kind: ProductListRowKind): boolean {
  return kind === "style";
}

export function shouldShowHasVariantsIndicator(
  hasVariants: boolean | undefined,
  kind: ProductListRowKind
): boolean {
  if (kind === "variant") return false;
  if (kind === "style") return true;
  return Boolean(hasVariants);
}

export function productListHasVariantsBadgeLabel(count?: number | null): string {
  if (typeof count === "number" && Number.isFinite(count) && count > 0) {
    return count === 1 ? "1 variant" : `${count} variants`;
  }
  return "variants";
}

export function productListRowKindBadgeVariant(
  kind: ProductListRowKind
): "active" | "completed" | "default" {
  switch (kind) {
    case "style":
      return "default";
    case "variant":
      return "completed";
    case "single":
      return "active";
  }
}
