import type { AstClause } from "@/lib/search/types";
import type { CategoryRow } from "@/lib/categories/types";
import type { LocationRow } from "@/lib/locations/types";
import type { StockAdjustmentRow, StockBalanceRow } from "@/lib/inventory/stock/types";
import type { StockTransferRow } from "@/lib/inventory/transfers/types";
import { stockTransferStatusLabel } from "@/lib/inventory/transfers/labels";

function resolveRowField(scope: "categories" | "locations", field: string): string {
  if (scope === "categories" && field === "category_name") return "name";
  return field;
}

function matchPredicate(
  row: Record<string, unknown>,
  clause: Extract<AstClause, { kind: "predicate" }>,
  scope: "categories" | "locations"
): boolean {
  const raw = row[resolveRowField(scope, clause.field)];
  const value = clause.value;

  switch (clause.operator) {
    case "EQ":
      return String(raw ?? "").toLowerCase() === String(value).toLowerCase();
    case "NEQ":
      return String(raw ?? "").toLowerCase() !== String(value).toLowerCase();
    case "IN":
      return Array.isArray(value)
        ? value.some((entry) => String(raw ?? "").toLowerCase() === String(entry).toLowerCase())
        : false;
    case "IS_NULL":
      return raw === null || raw === undefined || String(raw).trim() === "";
    case "IS_NOT_NULL":
      return raw !== null && raw !== undefined && String(raw).trim() !== "";
    case "ILIKE": {
      const needle = String(value);
      const haystack = String(raw ?? "").toLowerCase();
      if (needle.startsWith("^")) {
        return haystack.startsWith(needle.slice(1).toLowerCase());
      }
      return haystack.includes(needle.toLowerCase());
    }
    case "NOT_ILIKE": {
      const needle = String(value);
      const haystack = String(raw ?? "").toLowerCase();
      if (needle.startsWith("^")) {
        return !haystack.startsWith(needle.slice(1).toLowerCase());
      }
      return !haystack.includes(needle.toLowerCase());
    }
    case "GTE":
      return new Date(String(raw)).getTime() >= new Date(String(value)).getTime();
    case "LTE":
      return new Date(String(raw)).getTime() <= new Date(String(value)).getTime();
    case "BETWEEN":
      if (!Array.isArray(value) || value.length !== 2) return true;
      return (
        new Date(String(raw)).getTime() >= new Date(String(value[0])).getTime() &&
        new Date(String(raw)).getTime() <= new Date(String(value[1])).getTime()
      );
    default:
      return true;
  }
}

export function filterCategoriesByAst(rows: CategoryRow[], ast: AstClause[]): CategoryRow[] {
  const structural = ast.filter((c) => c.kind === "predicate");
  const textClauses = ast.filter((c) => c.kind === "text");

  let filtered = rows;
  for (const clause of structural) {
    if (clause.kind !== "predicate") continue;
    filtered = filtered.filter((row) =>
      matchPredicate(row as unknown as Record<string, unknown>, clause, "categories")
    );
  }

  for (const clause of textClauses) {
    if (clause.kind !== "text") continue;
    const q = clause.value.toLowerCase();
    filtered = filtered.filter((row) => row.name.toLowerCase().includes(q));
  }

  return filtered;
}

export function filterLocationsByAst(rows: LocationRow[], ast: AstClause[]): LocationRow[] {
  const structural = ast.filter((c) => c.kind === "predicate");
  const textClauses = ast.filter((c) => c.kind === "text");

  let filtered = rows;
  for (const clause of structural) {
    if (clause.kind !== "predicate") continue;
    filtered = filtered.filter((row) =>
      matchPredicate(row as unknown as Record<string, unknown>, clause, "locations")
    );
  }

  for (const clause of textClauses) {
    if (clause.kind !== "text") continue;
    const q = clause.value.toLowerCase();
    filtered = filtered.filter(
      (row) =>
        row.name.toLowerCase().includes(q) ||
        (row.code?.toLowerCase().includes(q) ?? false) ||
        (row.city?.toLowerCase().includes(q) ?? false)
    );
  }

  return filtered;
}

export function filterCategoriesByResidual(rows: CategoryRow[], residualText: string): CategoryRow[] {
  if (!residualText.trim()) return rows;
  return filterCategoriesByAst(rows, [{ kind: "text", value: residualText }]);
}

export function filterLocationsByResidual(rows: LocationRow[], residualText: string): LocationRow[] {
  if (!residualText.trim()) return rows;
  return filterLocationsByAst(rows, [{ kind: "text", value: residualText }]);
}

function transferStatusHaystack(status: StockTransferRow["current_status"]): string {
  return [status, stockTransferStatusLabel(status)].join(" ").toLowerCase();
}

function filterRowsByAst<T extends Record<string, unknown>>(
  rows: T[],
  ast: AstClause[],
  scope: "stock" | "transfers",
  textHaystack: (row: T) => string
): T[] {
  const structural = ast.filter((clause) => clause.kind === "predicate");
  const textClauses = ast.filter((clause) => clause.kind === "text");

  let filtered = rows;
  for (const clause of structural) {
    if (clause.kind !== "predicate") continue;
    filtered = filtered.filter((row) => {
      if (scope === "transfers" && clause.field === "current_status") {
        const needle = String(clause.value).toLowerCase();
        const haystack = transferStatusHaystack(
          row.current_status as StockTransferRow["current_status"]
        );
        switch (clause.operator) {
          case "EQ":
            return haystack.includes(needle);
          case "NEQ":
            return !haystack.includes(needle);
          case "ILIKE":
            return haystack.includes(needle.replace(/^\^/, ""));
          case "NOT_ILIKE":
            return !haystack.includes(needle.replace(/^\^/, ""));
          default:
            return matchPredicate(row, clause, "categories");
        }
      }
      return matchPredicate(row, clause, "categories");
    });
  }

  for (const clause of textClauses) {
    if (clause.kind !== "text") continue;
    const q = clause.value.toLowerCase();
    filtered = filtered.filter((row) => textHaystack(row).includes(q));
  }

  return filtered;
}

function stockBalanceHaystack(row: StockBalanceRow): string {
  return [row.location_name, row.location_code, row.item_name, row.variant_sku].join(" ").toLowerCase();
}

function stockAdjustmentHaystack(row: StockAdjustmentRow): string {
  return [
    row.adjustment_number,
    row.location_name,
    row.location_code,
    row.reason,
    row.kind,
  ]
    .join(" ")
    .toLowerCase();
}

function transferHaystack(row: StockTransferRow): string {
  return [
    row.transfer_number,
    row.source_location_name,
    row.source_location_code,
    row.destination_location_name,
    row.destination_location_code,
    stockTransferStatusLabel(row.current_status),
    row.current_status,
  ]
    .join(" ")
    .toLowerCase();
}

export function filterStockBalancesByAst(rows: StockBalanceRow[], ast: AstClause[]): StockBalanceRow[] {
  return filterRowsByAst(
    rows as unknown as Record<string, unknown>[],
    ast,
    "stock",
    (row) => stockBalanceHaystack(row as unknown as StockBalanceRow)
  ) as StockBalanceRow[];
}

export function filterStockAdjustmentsByAst(
  rows: StockAdjustmentRow[],
  ast: AstClause[]
): StockAdjustmentRow[] {
  return filterRowsByAst(
    rows as unknown as Record<string, unknown>[],
    ast,
    "stock",
    (row) => stockAdjustmentHaystack(row as unknown as StockAdjustmentRow)
  ) as StockAdjustmentRow[];
}

export function filterTransfersByAst(rows: StockTransferRow[], ast: AstClause[]): StockTransferRow[] {
  return filterRowsByAst(
    rows as unknown as Record<string, unknown>[],
    ast,
    "transfers",
    (row) => transferHaystack(row as unknown as StockTransferRow)
  ) as StockTransferRow[];
}

export function filterStockBalancesByResidual(
  rows: StockBalanceRow[],
  residualText: string
): StockBalanceRow[] {
  if (!residualText.trim()) return rows;
  return filterStockBalancesByAst(rows, [{ kind: "text", value: residualText }]);
}

export function filterStockAdjustmentsByResidual(
  rows: StockAdjustmentRow[],
  residualText: string
): StockAdjustmentRow[] {
  if (!residualText.trim()) return rows;
  return filterStockAdjustmentsByAst(rows, [{ kind: "text", value: residualText }]);
}

export function filterTransfersByResidual(rows: StockTransferRow[], residualText: string): StockTransferRow[] {
  if (!residualText.trim()) return rows;
  return filterTransfersByAst(rows, [{ kind: "text", value: residualText }]);
}
