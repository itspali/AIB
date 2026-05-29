import type { AstClause, CustomModuleView } from "@/lib/search/types";

export function extractStructuralAst(ast: AstClause[]): AstClause[] {
  return ast.filter((clause) => clause.kind !== "text");
}

export function savedViewNeedsNativeFilter(ast: AstClause[]): boolean {
  return extractStructuralAst(ast).length > 0;
}

export function buildCopyViewName(baseName: string, existingNames: string[]): string {
  const normalized = new Set(existingNames.map((name) => name.trim().toLowerCase()));
  const root = baseName.trim() || "View";
  let candidate = `${root} copy`;
  if (!normalized.has(candidate.toLowerCase())) return candidate;

  let index = 2;
  while (normalized.has(`${root} copy ${index}`.toLowerCase())) {
    index += 1;
  }
  return `${root} copy ${index}`;
}

export function serializeStructuralAst(ast: AstClause[]): string {
  return JSON.stringify(extractStructuralAst(ast));
}

export function normalizeSavedViewQuery(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function isSavedViewDirty(
  snapshot: Pick<CustomModuleView, "raw_search_text" | "compiled_ast"> | null,
  appliedQuery: string,
  activeAst: AstClause[]
): boolean {
  if (!snapshot) return false;

  const queryMatches =
    normalizeSavedViewQuery(snapshot.raw_search_text) === normalizeSavedViewQuery(appliedQuery);
  const astMatches =
    serializeStructuralAst(snapshot.compiled_ast) === serializeStructuralAst(activeAst);

  return !queryMatches || !astMatches;
}

export type SavedViewSnapshot = Pick<
  CustomModuleView,
  "id" | "raw_search_text" | "compiled_ast" | "module_name" | "view_name"
>;
