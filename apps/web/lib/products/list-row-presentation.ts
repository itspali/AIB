import {
  formatVariantAttributesSubline,
  resolveProductListDisplaySku,
} from "@/lib/products/list-row-key";
import type { ProductListRow } from "@/lib/products/types";
import {
  resolveProductListRowKind,
  shouldShowHasVariantsIndicator,
  type ProductListRowKind,
} from "@/lib/products/variant-strategy";

/**
 * Shared row classification for catalog list + card views.
 *
 * Rules:
 * - Variants expanded + variant_id + (MULTI_SKU or has_variants) → expanded variant row
 * - Injected/synthetic parent row (variant_id cleared) → style or single master row with Has variants
 * - MULTI_SKU + variants collapsed → style (master) row
 * - SINGLE_SKU without has_variants → single row (even if variant_id is present while expanded)
 */
export type ProductListRowPresentation = {
  kind: ProductListRowKind;
  isExpandedVariantRow: boolean;
  isStyleRow: boolean;
  isSingleRow: boolean;
  /** Product header row when the Variants list toggle is on (not a sellable line). */
  isProductGroupHeader: boolean;
  attributeSubline: string | null;
  displaySku: string | null;
  showHasVariantsIndicator: boolean;
};

export function resolveProductListRowPresentation(
  product: ProductListRow,
  showVariants: boolean
): ProductListRowPresentation {
  const kind = resolveProductListRowKind(product, showVariants);

  const isProductGroupHeader = showVariants && kind === "style";

  return {
    kind,
    isExpandedVariantRow: kind === "variant",
    isStyleRow: kind === "style",
    isSingleRow: kind === "single",
    isProductGroupHeader,
    attributeSubline:
      kind === "variant"
        ? formatVariantAttributesSubline(product.variant_attributes)
        : null,
    displaySku: resolveProductListDisplaySku(product, kind),
    showHasVariantsIndicator: shouldShowHasVariantsIndicator(product.has_variants, kind),
  };
}

/** List/table name cell indent for expanded variant rows only. */
export function productListVariantNameIndentClass(
  presentation: ProductListRowPresentation,
  showVariants: boolean
): string | undefined {
  if (!showVariants || !presentation.isExpandedVariantRow) return undefined;
  return "pl-6 sm:pl-8 border-l-2 border-border/60 ml-2";
}
