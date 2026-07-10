import type { ProductListRow } from "@/lib/products/types";

/**
 * How much to subtract from list `totalCount` after hard-deleting items.
 * Master mode: one row per item. Expand-variants: loaded variant rows for
 * those items, plus 1 per deleted item not present in the loaded page.
 */
export function resolveDeletedRowCountDelta(
  products: ProductListRow[],
  deletedIds: string[],
  expandVariants: boolean
): number {
  if (deletedIds.length === 0) return 0;
  if (!expandVariants) return deletedIds.length;
  const idSet = new Set(deletedIds);
  const removedLoaded = products.filter((row) => idSet.has(row.id));
  const loadedDeletedIds = new Set(removedLoaded.map((row) => row.id));
  const unloaded = deletedIds.filter((id) => !loadedDeletedIds.has(id)).length;
  return removedLoaded.length + unloaded;
}
