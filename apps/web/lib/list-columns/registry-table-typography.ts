import type { ListColumnDef } from "@/lib/list-columns/types";

/** Inner wrapper — inherits td typography (Items matrix parity). */
export const REGISTRY_TABLE_CELL_CONTENT = "matrix-table__cell-content min-w-0";

const AMOUNT_COLUMN_ID =
  /amount|price|cost|balance|limit|liability|paid|rate|value|selling|mrp|purchase/i;

const COUNT_COLUMN_ID =
  /lines|line_count|count|quantity|qty|on_hand|reserved|reorder|promo|on_hold|terms_days|stock/i;

export type RegistryTableCellTypography =
  | "prose"
  | "prose-primary"
  | "prose-muted"
  | "code"
  | "numeric"
  | "numeric-muted";

export function registryTableCellTypography(
  column: ListColumnDef,
  columnId: string
): RegistryTableCellTypography {
  switch (column.valueKind) {
    case "code":
      return "code";
    case "number":
      return COUNT_COLUMN_ID.test(columnId) && !AMOUNT_COLUMN_ID.test(columnId)
        ? "numeric-muted"
        : "numeric";
    case "date":
      return "numeric-muted";
    case "multiline":
      return "prose-muted";
    default:
      if (columnId === "name" || columnId === "customer" || columnId === "supplier") {
        return "prose-primary";
      }
      return "prose";
  }
}

export function registryTableBodyCellTypographyClass(
  column: ListColumnDef,
  columnId: string
): string {
  switch (registryTableCellTypography(column, columnId)) {
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

/** Inner span roles — same matrix lane tokens as Items body cells. */
export function registryTableInnerNumericClass(
  column: ListColumnDef,
  columnId: string
): string {
  return registryTableCellTypography(column, columnId) === "numeric-muted"
    ? "matrix-table__numeric matrix-table__numeric--muted"
    : "matrix-table__numeric";
}

export function registryTableInnerCodeClass(): string {
  return "matrix-table__code";
}

export function registryTableInnerProsePrimaryClass(): string {
  return "matrix-table__prose matrix-table__prose--primary";
}

export function registryTableInnerProseMutedClass(): string {
  return "matrix-table__prose matrix-table__prose--muted";
}

export function registryTableInnerDateClass(): string {
  return "matrix-table__numeric matrix-table__numeric--muted";
}
