import { resolveProductListRowPresentation } from "@/lib/products/list-row-presentation";
import type { ProductListRow } from "@/lib/products/types";

/**
 * Counts list rows for the workspace header ratio.
 * Synthetic variant parent/header rows are visible but not counted as data rows.
 */
export function countProductListWorkspaceRows(
  rows: readonly ProductListRow[],
  showVariants: boolean
): number {
  if (!showVariants) return rows.length;

  return rows.filter(
    (row) => !resolveProductListRowPresentation(row, true).isProductGroupHeader
  ).length;
}
