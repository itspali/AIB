import { resolveProductListRowPresentation } from "@/lib/products/list-row-presentation";
import { resolveProductListRowActiveStatus } from "@/lib/products/list-row-key";
import type { ProductListRow } from "@/lib/products/types";
import type { AstClause } from "@/lib/search/types";

type IsActivePredicate = Extract<AstClause, { kind: "predicate"; field: "is_active" }>;

function structuralAstClauses(ast: readonly AstClause[]): AstClause[] {
  return ast.filter((clause) => clause.kind !== "text");
}

export function findIsActivePredicate(ast: readonly AstClause[]): IsActivePredicate | null {
  const clause = ast.find(
    (entry): entry is IsActivePredicate =>
      entry.kind === "predicate" && entry.field === "is_active"
  );
  return clause ?? null;
}

/** True when native filter is only an operational active/inactive predicate. */
export function isActiveStatusOnlyStructuralFilter(ast: readonly AstClause[]): boolean {
  const structural = structuralAstClauses(ast);
  return structural.length === 1 && findIsActivePredicate(ast) !== null;
}

/**
 * Server `filteredItemIds` matches item-level `items.is_active`. Skip that intersection
 * for active-only filters so row-grain client filtering stays authoritative.
 */
export function shouldIntersectServerFilteredItemIds(ast: readonly AstClause[]): boolean {
  return !isActiveStatusOnlyStructuralFilter(ast);
}

function resolveActiveFilterTarget(predicate: IsActivePredicate): boolean | null {
  if (predicate.operator === "EQ") return Boolean(predicate.value);
  if (predicate.operator === "NEQ") return !Boolean(predicate.value);
  return null;
}

/**
 * Aligns omnibar `is_active` filters with list row presentation.
 * Native search filters items by `items.is_active`; expanded variant rows also
 * need variant-level active status and synthetic parent headers removed.
 */
export function applyListActiveStatusFilter(
  rows: ProductListRow[],
  ast: readonly AstClause[],
  showVariants: boolean
): ProductListRow[] {
  const predicate = findIsActivePredicate(ast);
  if (!predicate) return rows;

  const wantActive = resolveActiveFilterTarget(predicate);
  if (wantActive === null) return rows;

  return rows.filter((row) => {
    if (showVariants) {
      const presentation = resolveProductListRowPresentation(row, showVariants);
      if (presentation.isProductGroupHeader) return false;
    }

    const rowActive = resolveProductListRowActiveStatus(row, showVariants);
    return wantActive ? rowActive : !rowActive;
  });
}
