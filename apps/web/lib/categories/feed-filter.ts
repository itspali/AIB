import type { CategoryListRow } from "@/lib/categories/list-row";

/** Client-side feed filter for split list pane and matrix table (name / parent). */
export function filterCategoryListRowsByFeedQuery(
  rows: CategoryListRow[],
  query: string
): CategoryListRow[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;

  return rows.filter((row) => {
    if (row.name.toLowerCase().includes(normalized)) return true;
    if (row.parent_name?.toLowerCase().includes(normalized)) return true;
    return false;
  });
}
