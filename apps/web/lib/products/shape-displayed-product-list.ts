import { applyListActiveStatusFilter } from "@/lib/products/apply-list-active-filter";
import { countProductListWorkspaceRows } from "@/lib/products/list-workspace-count";
import {
  collapseVariantListRows,
  injectVariantParentRows,
} from "@/lib/products/list-row-key";
import {
  sortProductListRows,
  type ProductListSortDirection,
  type ProductListSortField,
} from "@/lib/products/list-sort";
import type { ProductListRow } from "@/lib/products/types";
import type { AstClause } from "@/lib/search/types";

export function shapeDisplayedProductListRows(
  rows: ProductListRow[],
  options: {
    showVariants: boolean;
    sortField: ProductListSortField;
    sortDirection: ProductListSortDirection;
    activeAst?: readonly AstClause[];
  }
): ProductListRow[] {
  const sorted = sortProductListRows(rows, options.sortField, options.sortDirection, {
    showVariants: options.showVariants,
  });
  const shaped = options.showVariants
    ? injectVariantParentRows(sorted)
    : collapseVariantListRows(sorted);

  return applyListActiveStatusFilter(shaped, options.activeAst ?? [], options.showVariants);
}

export function countDisplayedProductListRows(
  rows: readonly ProductListRow[],
  showVariants: boolean
): number {
  return countProductListWorkspaceRows(rows, showVariants);
}
