import {
  flattenSynonyms,
  resolveSynonymField,
  resolveSynonymFieldsInPhrase,
} from "@/lib/search/compiler/synonyms";
import {
  parseCreatedAfterDate,
  parseCreatedInTemporal,
} from "@/lib/search/compiler/temporal";
import type { AstClause, ResolvedFieldDictEntry } from "@/lib/search/types";

type CompareOp = "FIELD_GT" | "FIELD_GTE" | "FIELD_LT" | "FIELD_LTE" | "GT" | "GTE" | "LT" | "LTE";

const FIELD_COMPARE_PHRASES: { pattern: RegExp; operator: CompareOp }[] = [
  { pattern: /^(.+?)\s+is\s+more\s+than\s+(?:the\s+)?(.+)$/i, operator: "FIELD_GT" },
  { pattern: /^(.+?)\s+is\s+greater\s+than\s+(?:the\s+)?(.+)$/i, operator: "FIELD_GT" },
  { pattern: /^(.+?)\s+is\s+less\s+than\s+(?:the\s+)?(.+)$/i, operator: "FIELD_LT" },
  { pattern: /^(.+?)\s+is\s+at\s+least\s+(?:the\s+)?(.+)$/i, operator: "FIELD_GTE" },
  { pattern: /^(.+?)\s+is\s+at\s+most\s+(?:the\s+)?(.+)$/i, operator: "FIELD_LTE" },
  { pattern: /^(.+?)\s*>=\s*(?:the\s+)?(.+)$/i, operator: "FIELD_GTE" },
  { pattern: /^(.+?)\s*<=\s*(?:the\s+)?(.+)$/i, operator: "FIELD_LTE" },
  { pattern: /^(.+?)\s*>\s*(?:the\s+)?(.+)$/i, operator: "FIELD_GT" },
  { pattern: /^(.+?)\s*<\s*(?:the\s+)?(.+)$/i, operator: "FIELD_LT" },
];

function parseFieldCompare(
  clause: string,
  fieldDict: ResolvedFieldDictEntry[]
): AstClause | null {
  if (!fieldDict.length) return null;

  for (const { pattern, operator } of FIELD_COMPARE_PHRASES) {
    const match = clause.trim().match(pattern);
    if (!match?.[1] || !match[2]) continue;

    const leftField = resolveSynonymField(match[1], fieldDict);
    const rightField = resolveSynonymField(match[2], fieldDict);

    if (leftField && rightField) {
      return { kind: "field_compare", left: leftField, operator, right: rightField };
    }
  }

  return null;
}

function parseHavingLiteral(
  clause: string,
  fieldDict: ResolvedFieldDictEntry[]
): AstClause | null {
  const hsnMatch = clause.match(/^hsn\s+(?:number\s+)?(.+)$/i);
  if (hsnMatch?.[1] && resolveSynonymField("hsn number", fieldDict) === "hsn_sac_code") {
    return {
      kind: "predicate",
      field: "hsn_sac_code",
      operator: "EQ",
      value: hsnMatch[1].trim(),
    };
  }

  const categoryMatch = clause.match(/^category\s+(.+)$/i);
  if (categoryMatch?.[1]) {
    return {
      kind: "predicate",
      field: "category_name",
      operator: "EQ",
      value: categoryMatch[1].trim(),
    };
  }

  return null;
}

function parseInClause(clause: string, fieldDict: ResolvedFieldDictEntry[]): AstClause | null {
  const inMatch = clause.match(/^(.+?)\s+is\s+(.+)$/i);
  if (!inMatch?.[1] || !inMatch[2]) return null;

  const resolved = resolveSynonymFieldsInPhrase(inMatch[1], fieldDict);
  if (!resolved) return null;

  const values = inMatch[2]
    .split(/\s+or\s+/i)
    .map((value) => value.trim())
    .filter(Boolean);

  if (values.length < 2) return null;

  return {
    kind: "predicate",
    field: resolved.field,
    operator: "IN",
    value: values,
  };
}

function parseTemporalClause(
  clause: string,
  referenceDate?: Date,
  timezone?: string
): AstClause | null {
  const bounds = parseCreatedInTemporal(clause, referenceDate, timezone);
  if (bounds) {
    return {
      kind: "predicate",
      field: "created_at",
      operator: "BETWEEN",
      value: [bounds.start, bounds.end],
    };
  }

  const afterDate = parseCreatedAfterDate(clause);
  if (afterDate) {
    return {
      kind: "predicate",
      field: "created_at",
      operator: "GTE",
      value: afterDate,
    };
  }

  return null;
}

function parseSimplePredicate(
  clause: string,
  fieldDict: ResolvedFieldDictEntry[]
): AstClause | null {
  if (/\bis\s+(?:more|less|greater)\s+than\b|[<>]=?/i.test(clause)) {
    return null;
  }

  for (const entry of flattenSynonyms(fieldDict)) {
    const eqMatch = clause.match(new RegExp(`^${entry.synonym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(?:is\\s+)?(.+)$`, "i"));
    if (eqMatch?.[1]) {
      return {
        kind: "predicate",
        field: entry.field,
        operator: "EQ",
        value: eqMatch[1].trim(),
      };
    }
  }
  return null;
}

export function parseClause(
  clause: string,
  fieldDict: ResolvedFieldDictEntry[],
  options?: { referenceDate?: Date; timezone?: string }
): { clause: AstClause | null; unparsedToken: string | null } {
  const normalized = clause.trim();
  if (!normalized) return { clause: null, unparsedToken: null };

  const parsers = [
    () => parseFieldCompare(normalized, fieldDict),
    () => parseTemporalClause(normalized, options?.referenceDate, options?.timezone),
    () => parseHavingLiteral(normalized, fieldDict),
    () => parseInClause(normalized, fieldDict),
    () => parseSimplePredicate(normalized, fieldDict),
  ];

  for (const parser of parsers) {
    const result = parser();
    if (result) return { clause: result, unparsedToken: null };
  }

  return { clause: null, unparsedToken: normalized };
}

export function clauseToLabel(clause: AstClause): string {
  if (clause.kind === "text") return clause.value;
  if (clause.kind === "field_compare") {
    return `${clause.left} ${clause.operator.replace("FIELD_", "").toLowerCase()} ${clause.right}`;
  }
  if (clause.operator === "IN" && Array.isArray(clause.value)) {
    return `${clause.field} in ${clause.value.join(", ")}`;
  }
  if (clause.operator === "BETWEEN" && Array.isArray(clause.value)) {
    return `${clause.field} between ${clause.value[0]} – ${clause.value[1]}`;
  }
  return `${clause.field} ${clause.operator.toLowerCase()} ${String(clause.value)}`;
}
