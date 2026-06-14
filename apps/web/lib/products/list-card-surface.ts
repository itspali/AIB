import type { ProductListRowPresentation } from "@/lib/products/list-row-presentation";
import { cn } from "@/lib/utils";

/** Solid card surface — see globals.css `.product-list-card` for theme backgrounds. */
export const productListCardShellClass =
  "product-list-card rounded-xl border border-border/80 shadow-md shadow-black/[0.04] dark:border-border dark:shadow-[0_1px_2px_rgba(0,0,0,0.4),0_6px_16px_rgba(0,0,0,0.28)]";

/** Theme-primary outline on hover; background stays solid. */
export const productListCardHoverClass =
  "transition-all duration-200 hover:border-primary hover:ring-2 hover:ring-primary/30";

export function productListCardSurfaceClass(
  presentation: ProductListRowPresentation,
  selected: boolean
): string | undefined {
  if (selected) {
    return cn(
      "border-primary ring-2 ring-primary/35",
      "hover:border-primary hover:ring-2 hover:ring-primary/45"
    );
  }

  if (presentation.isExpandedVariantRow) {
    return "border-dashed hover:border-solid";
  }

  return undefined;
}
