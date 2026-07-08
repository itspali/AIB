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

/** Footnote for the Variant field info popover (options are in {@link VARIANT_STRATEGY_CHOICES}). */
export const VARIANT_STRATEGY_FIELD_FOOTNOTE = "Not about whether you sell online.";

/** True when the user may pick Single SKU (not when multiple sellable variants already exist). */
export function canSelectSingleVariantStrategy(sellableVariantCount: number): boolean {
  return sellableVariantCount <= 1;
}

export type InferVariantStrategyInput = {
  sellableVariantCount: number;
  /** Includes master/style rows — used when one sellable SKU sits under a multi style. */
  totalVariantRows?: number;
  persistedStrategy?: ProductVariantStrategy;
  /** Non-empty `variant_axes` implies multi-SKU setup before sellable rows exist. */
  selectedAxisCount?: number;
};

/**
 * Derives `variant_strategy` from sellable SKU rows. Users never pick strategy directly.
 */
export function inferVariantStrategy(input: InferVariantStrategyInput): ProductVariantStrategy {
  const {
    sellableVariantCount,
    totalVariantRows = 0,
    persistedStrategy,
    selectedAxisCount = 0,
  } = input;
  const hasSelectedAxes = selectedAxisCount > 0;

  if (sellableVariantCount >= 2) {
    return "MULTI_SKU";
  }

  if (sellableVariantCount === 1) {
    if (persistedStrategy === "MULTI_SKU" || totalVariantRows > 1 || hasSelectedAxes) {
      return "MULTI_SKU";
    }
    return "SINGLE_SKU";
  }

  if (persistedStrategy === "MULTI_SKU" || hasSelectedAxes) {
    return "MULTI_SKU";
  }

  return "SINGLE_SKU";
}

/** Labels and guidance for the product editor variant picker. */
export const VARIANT_STRATEGY_CHOICES: VariantStrategyChoice[] = [
  {
    value: "SINGLE_SKU",
    label: "Single",
    description:
      "One product code for the whole item. Use when there is only one sellable version.",
  },
  {
    value: "MULTI_SKU",
    label: "Multiple",
    description:
      "A separate code for each version (size, color, etc.). Add variants after you save.",
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
