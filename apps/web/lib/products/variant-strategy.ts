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

/** Labels and guidance for the product editor variant picker. */
export const VARIANT_STRATEGY_CHOICES: VariantStrategyChoice[] = [
  {
    value: "SINGLE_SKU",
    label: "Single",
    description:
      "One code for the whole item. Best when there is only one version (no separate sizes or colors).",
  },
  {
    value: "MULTI_SKU",
    label: "Multiple",
    description:
      "A code for each version (size, color, etc.). Add versions after you save the item.",
  },
];

export function variantStrategyLabel(strategy: ProductVariantStrategy): string {
  return (
    VARIANT_STRATEGY_CHOICES.find((choice) => choice.value === strategy)?.label ??
    strategy
  );
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
      return "Style";
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

export function productListHasVariantsBadgeLabel(): string {
  return "Has variants";
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
