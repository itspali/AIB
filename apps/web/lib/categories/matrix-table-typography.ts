import type { CategoryListColumnId } from "@/lib/categories/list-columns";

export type MatrixColumnTypography = "prose" | "prose-primary" | "numeric" | "numeric-muted";

export function matrixColumnTypography(columnId: CategoryListColumnId): MatrixColumnTypography {
  switch (columnId) {
    case "name":
      return "prose-primary";
    case "item_count":
    case "attribute_count":
      return "numeric";
    case "created_at":
    case "updated_at":
      return "numeric-muted";
    default:
      return "prose";
  }
}

export function matrixCellClass(columnId: CategoryListColumnId, blank = false): string {
  if (blank) {
    return "matrix-table__prose matrix-table__prose--muted";
  }

  switch (matrixColumnTypography(columnId)) {
    case "prose-primary":
      return "matrix-table__prose matrix-table__prose--primary";
    case "numeric":
      return "matrix-table__numeric";
    case "numeric-muted":
      return "matrix-table__numeric matrix-table__numeric--muted";
    default:
      return "matrix-table__prose";
  }
}

export function matrixHeaderClass(_columnId: CategoryListColumnId): string {
  return "matrix-table__header";
}
