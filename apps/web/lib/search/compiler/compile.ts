import { collectResidualSegments, segmentClauses } from "@/lib/search/compiler/tokenizer";
import { clauseToLabel } from "@/lib/search/compiler/clause-label";
import { expandNumericRangeSegment, parseClause } from "@/lib/search/compiler/parser";
import type {  AstClause,
  CompileResult,
  FilterScope,
  ResolvedFieldDictEntry,
} from "@/lib/search/types";

export type CompileOptions = {
  referenceDate?: Date;
  timezone?: string;
};

export function compileFilterQuery(
  query: string,
  _scope: FilterScope,
  fieldDict: ResolvedFieldDictEntry[],
  options?: CompileOptions
): CompileResult {
  const started = performance.now();
  const segments = segmentClauses(query).flatMap(expandNumericRangeSegment);
  const ast: AstClause[] = [];
  const unparsedTokens: string[] = [];
  const clauseSegments: string[] = [];
  const consumed = new Set<number>();

  segments.forEach((segment, index) => {
    const { clause, unparsedToken } = parseClause(segment, fieldDict, options);
    if (clause) {
      ast.push(clause);
      if (clause.kind !== "text") {
        clauseSegments.push(segment);
      }
      consumed.add(index);
      return;
    }
    if (unparsedToken) unparsedTokens.push(unparsedToken);
  });

  const residualText = collectResidualSegments(segments, consumed);
  if (residualText) {
    ast.push({ kind: "text", value: residualText });
  }

  const compileMicros = Math.round((performance.now() - started) * 1000);

  return {
    ast,
    unparsedTokens: [...unparsedTokens, ...(residualText ? [residualText] : [])],
    compileMicros,
    residualText,
    clauseSegments,
  };
}

export { clauseToLabel };
