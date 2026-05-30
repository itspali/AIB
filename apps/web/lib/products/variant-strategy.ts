export const PRODUCT_VARIANT_STRATEGIES = ["SINGLE_SKU", "MULTI_SKU"] as const;

export type ProductVariantStrategy = (typeof PRODUCT_VARIANT_STRATEGIES)[number];

export function isProductVariantStrategy(value: string): value is ProductVariantStrategy {
  return (PRODUCT_VARIANT_STRATEGIES as readonly string[]).includes(value);
}

export function variantStrategyLabel(strategy: ProductVariantStrategy): string {
  switch (strategy) {
    case "SINGLE_SKU":
      return "Single SKU";
    case "MULTI_SKU":
      return "Multi-variant style";
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
  if (strategy === "MULTI_SKU") {
    return showVariants && row.variant_id ? "variant" : "style";
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
