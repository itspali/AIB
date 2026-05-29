import type { AstClause } from "@/lib/search/types";
import type { CategoryRow } from "@/lib/categories/types";
import type { LocationRow } from "@/lib/locations/types";

function matchPredicate(row: Record<string, unknown>, clause: Extract<AstClause, { kind: "predicate" }>): boolean {
  const raw = row[clause.field];
  const value = clause.value;

  switch (clause.operator) {
    case "EQ":
      return String(raw ?? "").toLowerCase() === String(value).toLowerCase();
    case "IN":
      return Array.isArray(value)
        ? value.some((entry) => String(raw ?? "").toLowerCase() === String(entry).toLowerCase())
        : false;
    case "ILIKE": {
      const needle = String(value);
      const haystack = String(raw ?? "").toLowerCase();
      if (needle.startsWith("^")) {
        return haystack.startsWith(needle.slice(1).toLowerCase());
      }
      return haystack.includes(needle.toLowerCase());
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
      matchPredicate(row as unknown as Record<string, unknown>, clause)
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
      matchPredicate(row as unknown as Record<string, unknown>, clause)
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
