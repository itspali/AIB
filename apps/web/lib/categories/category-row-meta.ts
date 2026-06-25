import type { CategoryListColumnId } from "@/lib/categories/list-columns";
import { getCategoryColumnDef } from "@/lib/categories/list-columns";
import type { CategoryListRow } from "@/lib/categories/list-row";

/** Meta fields shown on tree rows and split feed cards (excludes name). */
export const CATEGORY_ROW_META_COLUMN_IDS: CategoryListColumnId[] = [
  "parent_name",
  "item_count",
  "default_variant_strategy",
  "updated_at",
];

/** Hidden from tree/feed meta; inactive state uses row styling instead (matches Items). */
export const CATEGORIES_WORKSPACE_DISABLED_COLUMNS = ["is_active"] as const satisfies readonly CategoryListColumnId[];

const CATEGORIES_WORKSPACE_DISABLED_COLUMN_SET = new Set<CategoryListColumnId>(
  CATEGORIES_WORKSPACE_DISABLED_COLUMNS
);

export function withoutCategoriesWorkspaceDisabledColumns(
  columns: readonly CategoryListColumnId[]
): CategoryListColumnId[] {
  return columns.filter((columnId) => !CATEGORIES_WORKSPACE_DISABLED_COLUMN_SET.has(columnId));
}

export function resolveCategoryRowMetaColumns(
  visibleColumns: CategoryListColumnId[],
  max = 4
): CategoryListColumnId[] {
  return withoutCategoriesWorkspaceDisabledColumns(
    CATEGORY_ROW_META_COLUMN_IDS.filter(
      (columnId) => columnId !== "name" && visibleColumns.includes(columnId)
    )
  ).slice(0, max);
}

export function formatCategoryRowMetaLabel(columnId: CategoryListColumnId): string {
  return getCategoryColumnDef(columnId).label;
}

export type CategoryRowMetaSegment = {
  columnId: CategoryListColumnId;
  label: string;
  row: CategoryListRow;
};

export function buildCategoryRowMetaSegments(
  row: CategoryListRow,
  visibleColumns: CategoryListColumnId[],
  max = 4
): CategoryRowMetaSegment[] {
  return resolveCategoryRowMetaColumns(visibleColumns, max).map((columnId) => ({
    columnId,
    label: formatCategoryRowMetaLabel(columnId),
    row,
  }));
}
