import type { CategoryRow } from "@/lib/categories/types";
import { collectDescendantIds } from "@/lib/categories/tree";

type CategoryParentRow = Pick<CategoryRow, "id" | "parent_id">;

export function validateCategoryParentAssignment(
  categoryId: string | null,
  parentId: string | null,
  rows: CategoryParentRow[]
): string | null {
  if (!parentId) return null;

  if (!rows.some((row) => row.id === parentId)) {
    return "Parent category not found";
  }

  if (categoryId && parentId === categoryId) {
    return "Category cannot be its own parent";
  }

  if (categoryId && collectDescendantIds(categoryId, rows as CategoryRow[]).has(parentId)) {
    return "Parent category cannot be a descendant of this category";
  }

  return null;
}
