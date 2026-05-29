import { getFieldsForScope } from "@/lib/search/permissions/field-registry";
import type { AstClause, FilterScope, SearchFieldPermissions } from "@/lib/search/types";

const ALLOWED_OPERATORS = new Set([
  "EQ",
  "NEQ",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "IN",
  "BETWEEN",
  "FIELD_GT",
  "FIELD_GTE",
  "FIELD_LT",
  "FIELD_LTE",
  "ILIKE",
  "NOT_ILIKE",
  "IS_NULL",
  "IS_NOT_NULL",
]);

export type ValidateAstResult =
  | { ok: true; ast: AstClause[] }
  | { ok: false; error: "FORBIDDEN_FIELD" | "INVALID_OPERATOR" | "INVALID_AST"; field?: string };

function collectFields(clause: AstClause): string[] {
  if (clause.kind === "field_compare") return [clause.left, clause.right];
  if (clause.kind === "predicate") return [clause.field];
  return [];
}

export function validateFilterAst(
  ast: AstClause[],
  scope: FilterScope,
  permissions: SearchFieldPermissions
): ValidateAstResult {
  if (permissions.throttled) {
    const structural = ast.filter((c) => c.kind !== "text");
    if (structural.length > 0) {
      return { ok: false, error: "FORBIDDEN_FIELD", field: structural[0] && collectFields(structural[0])[0] };
    }
  }

  const allowedKeys = new Set(
    getFieldsForScope(scope)
      .filter((entry) => {
        if (entry.sensitivity === "financial" && !permissions.financialVisible) return false;
        return permissions.allowedFields.includes(entry.key);
      })
      .map((entry) => entry.key)
  );

  for (const clause of ast) {
    if (clause.kind === "text") continue;

    if (clause.kind === "predicate" && !ALLOWED_OPERATORS.has(clause.operator)) {
      return { ok: false, error: "INVALID_OPERATOR", field: clause.field };
    }

    if (clause.kind === "field_compare" && !ALLOWED_OPERATORS.has(clause.operator)) {
      return { ok: false, error: "INVALID_OPERATOR", field: clause.left };
    }

    for (const field of collectFields(clause)) {
      if (!allowedKeys.has(field)) {
        return { ok: false, error: "FORBIDDEN_FIELD", field };
      }
    }
  }

  return { ok: true, ast };
}
