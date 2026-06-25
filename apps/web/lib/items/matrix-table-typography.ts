import type { ProductListColumnId } from "@/lib/products/list-columns";
import { LIST_WORKSPACE_REGISTRY_HEADER } from "@/lib/layout/list-table-chrome";

export type MatrixColumnTypography =
  | "image"
  | "prose"
  | "prose-primary"
  | "prose-muted"
  | "code"
  | "numeric"
  | "numeric-muted";

export function matrixColumnTypography(columnId: ProductListColumnId): MatrixColumnTypography {
  switch (columnId) {
    case "image":
      return "image";
    case "name":
      return "prose-primary";
    case "description":
      return "prose-muted";
    case "default_sku":
    case "barcode":
    case "hsn_sac_code":
      return "code";
    case "selling_price":
    case "mrp":
    case "purchase_price":
    case "stock_on_hand":
      return "numeric";
    case "created_at":
    case "updated_at":
      return "numeric-muted";
    default:
      return "prose";
  }
}

export function matrixCellClass(columnId: ProductListColumnId, blank = false): string {
  if (blank) {
    return "matrix-table__prose matrix-table__prose--muted";
  }

  switch (matrixColumnTypography(columnId)) {
    case "image":
      return "matrix-table__image";
    case "prose-primary":
      return "matrix-table__prose matrix-table__prose--primary";
    case "prose-muted":
      return "matrix-table__prose matrix-table__prose--muted";
    case "code":
      return "matrix-table__code";
    case "numeric":
      return "matrix-table__numeric";
    case "numeric-muted":
      return "matrix-table__numeric matrix-table__numeric--muted";
    default:
      return "matrix-table__prose";
  }
}

export function matrixHeaderClass(_columnId: ProductListColumnId): string {
  return LIST_WORKSPACE_REGISTRY_HEADER;
}
