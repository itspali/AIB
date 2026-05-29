import type { AstClause } from "@/lib/search/types";

export type CatalogSearchRow = {
  item_id: string;
  name: string | null;
  description: string | null;
  category_id: string | null;
  category_name: string | null;
  hsn_sac_code: string | null;
  base_unit_of_measure: string | null;
  created_at: string | null;
  default_sku: string | null;
  selling_price: number | string | null;
  purchase_price: number | string | null;
  is_active: boolean | null;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesClause(row: CatalogSearchRow, clause: AstClause): boolean {
  if (clause.kind === "text") {
    const q = clause.value.trim().toLowerCase();
    if (!q) return true;
    return (
      (row.name?.toLowerCase().includes(q) ?? false) ||
      (row.description?.toLowerCase().includes(q) ?? false) ||
      (row.default_sku?.toLowerCase().includes(q) ?? false)
    );
  }

  if (clause.kind === "field_compare") {
    const left = toNumber(row[clause.left as keyof CatalogSearchRow]);
    const right = toNumber(row[clause.right as keyof CatalogSearchRow]);
    if (left === null || right === null) return false;

    switch (clause.operator) {
      case "FIELD_GT":
        return left > right;
      case "FIELD_GTE":
        return left >= right;
      case "FIELD_LT":
        return left < right;
      case "FIELD_LTE":
        return left <= right;
      default:
        return true;
    }
  }

  if (clause.kind !== "predicate") return true;

  const { field, operator, value } = clause;
  const raw = row[field as keyof CatalogSearchRow];

  switch (operator) {
    case "EQ":
      if (field === "is_active") {
        return Boolean(raw) === Boolean(value);
      }
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
    case "GT": {
      const numeric = toNumber(raw);
      const threshold = toNumber(value);
      return numeric !== null && threshold !== null && numeric > threshold;
    }
    case "GTE": {
      const numeric = toNumber(raw);
      const threshold = toNumber(value);
      if (numeric !== null && threshold !== null) {
        return numeric >= threshold;
      }
      return new Date(String(raw)).getTime() >= new Date(String(value)).getTime();
    }
    case "LT": {
      const numeric = toNumber(raw);
      const threshold = toNumber(value);
      return numeric !== null && threshold !== null && numeric < threshold;
    }
    case "LTE": {
      const numeric = toNumber(raw);
      const threshold = toNumber(value);
      if (numeric !== null && threshold !== null) {
        return numeric <= threshold;
      }
      return new Date(String(raw)).getTime() <= new Date(String(value)).getTime();
    }
    case "BETWEEN":
      if (!Array.isArray(value) || value.length !== 2) return true;
      {
        const numeric = toNumber(raw);
        const min = toNumber(value[0]);
        const max = toNumber(value[1]);
        if (numeric !== null && min !== null && max !== null) {
          return numeric >= min && numeric <= max;
        }
        return (
          new Date(String(raw)).getTime() >= new Date(String(value[0])).getTime() &&
          new Date(String(raw)).getTime() <= new Date(String(value[1])).getTime()
        );
      }
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
    default:
      return true;
  }
}

export function filterCatalogRowsInMemory(
  rows: CatalogSearchRow[],
  ast: AstClause[]
): string[] {
  const structural = ast.filter((clause) => clause.kind !== "text");
  const textClauses = ast.filter((clause) => clause.kind === "text");

  return rows
    .filter((row) => structural.every((clause) => matchesClause(row, clause)))
    .filter((row) => textClauses.every((clause) => matchesClause(row, clause)))
    .map((row) => row.item_id);
}
