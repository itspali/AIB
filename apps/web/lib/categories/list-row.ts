import type { CategoryRow } from "@/lib/categories/types";

export type CategoryListRow = CategoryRow & {
  parent_name: string;
  item_count: number;
  attribute_count: number;
};

export function enrichCategoryListRows(
  rows: CategoryRow[],
  allRows: CategoryRow[],
  itemCountByCategoryId: Record<string, number> = {}
): CategoryListRow[] {
  const byId = new Map(allRows.map((row) => [row.id, row]));
  return rows.map((row) => ({
    ...row,
    parent_name: row.parent_id
      ? (byId.get(row.parent_id)?.name ?? "—")
      : "—",
    item_count: itemCountByCategoryId[row.id] ?? 0,
    attribute_count: row.attribute_templates.length,
  }));
}
