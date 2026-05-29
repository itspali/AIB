import {
  flattenSynonyms,
  resolveSynonymField,
  resolveSynonymFieldsInPhrase,
} from "@/lib/search/compiler/synonyms";
import {
  parseCreatedAfterDate,
  parseCreatedInTemporal,
} from "@/lib/search/compiler/temporal";
import { isNumericFilterField, isBooleanFilterField } from "@/lib/search/permissions/field-labels";
import type { AstClause, ResolvedFieldDictEntry } from "@/lib/search/types";

type CompareOp = "FIELD_GT" | "FIELD_GTE" | "FIELD_LT" | "FIELD_LTE" | "GT" | "GTE" | "LT" | "LTE";

const NUMERIC_LITERAL = String.raw`([\d,]+(?:\.\d+)?)`;

const NUMERIC_COMPARE_PHRASES: { pattern: RegExp; operator: CompareOp }[] = [
  { pattern: new RegExp(`^(.+?)\\s+is\\s+more\\s+than\\s+${NUMERIC_LITERAL}$`, "i"), operator: "GT" },
  { pattern: new RegExp(`^(.+?)\\s+is\\s+greater\\s+than\\s+${NUMERIC_LITERAL}$`, "i"), operator: "GT" },
  { pattern: new RegExp(`^(.+?)\\s+is\\s+less\\s+than\\s+${NUMERIC_LITERAL}$`, "i"), operator: "LT" },
  { pattern: new RegExp(`^(.+?)\\s+is\\s+at\\s+least\\s+${NUMERIC_LITERAL}$`, "i"), operator: "GTE" },
  { pattern: new RegExp(`^(.+?)\\s+is\\s+at\\s+most\\s+${NUMERIC_LITERAL}$`, "i"), operator: "LTE" },
  { pattern: new RegExp(`^(.+?)\\s*>=\\s*${NUMERIC_LITERAL}$`, "i"), operator: "GTE" },
  { pattern: new RegExp(`^(.+?)\\s*<=\\s*${NUMERIC_LITERAL}$`, "i"), operator: "LTE" },
  { pattern: new RegExp(`^(.+?)\\s*>\\s*${NUMERIC_LITERAL}$`, "i"), operator: "GT" },
  { pattern: new RegExp(`^(.+?)\\s*<\\s*${NUMERIC_LITERAL}$`, "i"), operator: "LT" },
];

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

function parseNumericLiteral(raw: string): number | null {
  const normalized = raw.replace(/,/g, "").trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNumericPredicate(
  clause: string,
  fieldDict: ResolvedFieldDictEntry[]
): AstClause | null {
  if (!fieldDict.length) return null;

  for (const { pattern, operator } of NUMERIC_COMPARE_PHRASES) {
    const match = clause.trim().match(pattern);
    if (!match?.[1] || !match[2]) continue;

    const field = resolveSynonymField(match[1], fieldDict);
    const value = parseNumericLiteral(match[2]);
    if (!field || !isNumericFilterField(field) || value === null) continue;

    return { kind: "predicate", field, operator, value };
  }

  return null;
}

function parseNumericBetween(
  clause: string,
  fieldDict: ResolvedFieldDictEntry[]
): AstClause | null {
  const match = clause
    .trim()
    .match(new RegExp(`^(.+?)\\s+(?:is\\s+)?between\\s+${NUMERIC_LITERAL}\\s+and\\s+${NUMERIC_LITERAL}$`, "i"));
  if (!match?.[1] || !match[2] || !match[3]) return null;

  const field = resolveSynonymField(match[1], fieldDict);
  const min = parseNumericLiteral(match[2]);
  const max = parseNumericLiteral(match[3]);
  if (!field || !isNumericFilterField(field) || min === null || max === null) return null;

  return {
    kind: "predicate",
    field,
    operator: "BETWEEN",
    value: min <= max ? [min, max] : [max, min],
  };
}

/** Expands "field more than X but less than Y" into two comparable segments. */
export function expandNumericRangeSegment(segment: string): string[] {
  const match = segment
    .trim()
    .match(new RegExp(`^(.+?)\\s+(?:is\\s+)?more\\s+than\\s+${NUMERIC_LITERAL}\\s+but\\s+less\\s+than\\s+${NUMERIC_LITERAL}$`, "i"));
  if (!match?.[1] || !match[2] || !match[3]) return [segment];

  const field = match[1].trim();
  return [`${field} > ${match[2]}`, `${field} < ${match[3]}`];
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

const TEXT_SUBSTRING_FIELDS = new Set(["name", "default_sku"]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseSubstringPredicate(
  clause: string,
  fieldDict: ResolvedFieldDictEntry[]
): AstClause | null {
  for (const entry of flattenSynonyms(fieldDict)) {
    const synonym = escapeRegex(entry.synonym);

    const explicitMatch = clause.match(
      new RegExp(
        `^${synonym}\\s+(?:contains|like|includes)\\s+(.+)$`,
        "i"
      )
    );
    if (explicitMatch?.[1]) {
      return {
        kind: "predicate",
        field: entry.field,
        operator: "ILIKE",
        value: explicitMatch[1].trim(),
      };
    }

    const startsWithMatch = clause.match(
      new RegExp(`^${synonym}\\s+starts\\s+with\\s+(.+)$`, "i")
    );
    if (startsWithMatch?.[1]) {
      return {
        kind: "predicate",
        field: entry.field,
        operator: "ILIKE",
        value: `^${startsWithMatch[1].trim()}`,
      };
    }

    if (!TEXT_SUBSTRING_FIELDS.has(entry.field)) continue;

    const isMatch = clause.match(new RegExp(`^${synonym}\\s+is\\s+(.+)$`, "i"));
    if (isMatch?.[1] && !/\s+or\s+/i.test(isMatch[1])) {
      return {
        kind: "predicate",
        field: entry.field,
        operator: "ILIKE",
        value: isMatch[1].trim(),
      };
    }

    const bareMatch = clause.match(new RegExp(`^${synonym}\\s+(.+)$`, "i"));
    if (bareMatch?.[1]) {
      const value = bareMatch[1].trim();
      if (/^(?:contains|like|includes|starts)\b/i.test(value)) continue;
      return {
        kind: "predicate",
        field: entry.field,
        operator: "ILIKE",
        value,
      };
    }
  }

  return null;
}

function parseBooleanLiteral(raw: string): boolean | null {
  const normalized = raw.trim().toLowerCase();
  if (["true", "yes", "active", "enabled"].includes(normalized)) return true;
  if (["false", "no", "inactive", "disabled"].includes(normalized)) return false;
  return null;
}

function parseActiveStatusClause(
  clause: string,
  fieldDict: ResolvedFieldDictEntry[]
): AstClause | null {
  if (!fieldDict.some((entry) => entry.key === "is_active")) return null;

  const normalized = clause.trim().toLowerCase();
  const patterns: { pattern: RegExp; value: boolean }[] = [
    { pattern: /^(?:active|active\s+items?)$/, value: true },
    { pattern: /^(?:inactive|inactive\s+items?)$/, value: false },
    { pattern: /^is\s+active$/, value: true },
    { pattern: /^is\s+inactive$/, value: false },
    { pattern: /^status\s+is\s+active$/, value: true },
    { pattern: /^status\s+is\s+inactive$/, value: false },
    { pattern: /^status\s+active$/, value: true },
    { pattern: /^status\s+inactive$/, value: false },
  ];

  for (const { pattern, value } of patterns) {
    if (pattern.test(normalized)) {
      return { kind: "predicate", field: "is_active", operator: "EQ", value };
    }
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
      const value = eqMatch[1].trim();
      if (INCOMPLETE_VALUE_TOKENS.test(value)) return null;
      if (entry.field === "is_active") {
        const boolValue = parseBooleanLiteral(value);
        if (boolValue === null) return null;
        return {
          kind: "predicate",
          field: entry.field,
          operator: "EQ",
          value: boolValue,
        };
      }
      return {
        kind: "predicate",
        field: entry.field,
        operator: "EQ",
        value,
      };
    }
  }
  return null;
}

const INCOMPLETE_VALUE_TOKENS =
  /^(?:contains|like|includes|is|starts(?:\s+with)?|more|less|greater|at\s+least|at\s+most|between|having|and|or)$/i;

const TRAILING_INCOMPLETE_CLAUSE =
  /\b(?:contains|like|includes|is|starts\s+with|more\s+than|less\s+than|at\s+least|at\s+most|between|having|and|or)$/i;

const TRAILING_COMPARE_OPERATOR = /(?:>=|<=|>|<)\s*$/;

/** True when the clause text ends mid-expression (operator/field with no value yet). */
export function isIncompleteFilterClause(clause: string): boolean {
  const normalized = clause.trim();
  if (!normalized) return true;
  if (TRAILING_INCOMPLETE_CLAUSE.test(normalized)) return true;
  if (TRAILING_COMPARE_OPERATOR.test(normalized)) return true;
  return false;
}

/** True when a clause is complete enough to add as a modal draft criterion or apply. */
export function isDraftReadyFilterClause(
  clause: string,
  fieldDict: ResolvedFieldDictEntry[],
  options?: { referenceDate?: Date; timezone?: string }
): boolean {
  const normalized = clause.trim();
  if (!normalized || isIncompleteFilterClause(normalized)) return false;
  return parseClause(normalized, fieldDict, options).clause !== null;
}

export function isParseableFilterClause(
  clause: string,
  fieldDict: ResolvedFieldDictEntry[],
  options?: { referenceDate?: Date; timezone?: string }
): boolean {
  return parseClause(clause, fieldDict, options).clause !== null;
}

export function parseClause(
  clause: string,
  fieldDict: ResolvedFieldDictEntry[],
  options?: { referenceDate?: Date; timezone?: string }
): { clause: AstClause | null; unparsedToken: string | null } {
  const normalized = clause.trim();
  if (!normalized) return { clause: null, unparsedToken: null };

  const parsers = [
    () => parseActiveStatusClause(normalized, fieldDict),
    () => parseFieldCompare(normalized, fieldDict),
    () => parseNumericBetween(normalized, fieldDict),
    () => parseNumericPredicate(normalized, fieldDict),
    () => parseTemporalClause(normalized, options?.referenceDate, options?.timezone),
    () => parseHavingLiteral(normalized, fieldDict),
    () => parseInClause(normalized, fieldDict),
    () => parseSubstringPredicate(normalized, fieldDict),
    () => parseSimplePredicate(normalized, fieldDict),
  ];

  for (const parser of parsers) {
    const result = parser();
    if (result) return { clause: result, unparsedToken: null };
  }

  return { clause: null, unparsedToken: normalized };
}
