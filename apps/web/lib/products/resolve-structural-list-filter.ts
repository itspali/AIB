import { shouldIntersectServerFilteredItemIds } from "@/lib/products/apply-list-active-filter";
import { applyFallbackTextFilter } from "@/lib/search/executor/apply-fallback-text";
import type { AstClause } from "@/lib/search/types";
import type { ProductListRow } from "@/lib/products/types";

export function applyProductListStructuralFilters(
  rows: ProductListRow[],
  options: {
    appliedQuery: string;
    activeAst: readonly AstClause[];
    filteredItemIds: Set<string> | null | undefined;
    residualText?: string | null;
    inlinePreviewText?: string | null;
    structuralFilterResolved?: boolean;
  }
): ProductListRow[] {
  let result = rows;

  if (options.appliedQuery.trim()) {
    const hasStructuralFilter = options.activeAst.some((clause) => clause.kind !== "text");

    if (
      hasStructuralFilter &&
      !options.structuralFilterResolved &&
      options.filteredItemIds &&
      shouldIntersectServerFilteredItemIds(options.activeAst)
    ) {
      result = result.filter((product) => options.filteredItemIds!.has(product.id));
    } else if (!hasStructuralFilter && options.residualText) {
      result = applyFallbackTextFilter(
        result.map((row) => ({ ...row, description: null })),
        options.residualText
      );
    }
  }

  if (options.inlinePreviewText) {
    result = applyFallbackTextFilter(
      result.map((row) => ({ ...row, description: null })),
      options.inlinePreviewText
    );
  }

  return result;
}
