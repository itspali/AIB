import { flattenSynonyms, resolveSynonymField } from "@/lib/search/compiler/synonyms";
import { isDraftReadyFilterClause } from "@/lib/search/compiler/parser";
import { matchNavigationIndex } from "@/lib/search/navigation-index";
import { getFieldDisplayLabel } from "@/lib/search/permissions/field-labels";
import {
  findOperatorOption,
  getDateRelativePeriodOptions,
  getOperatorsForField,
  getValuePartForOperator,
  type FieldOperatorOption,
} from "@/lib/search/permissions/field-operators";
import type {
  FilterScope,
  FilterValueOption,
  OmnibarHint,
  ResolvedFieldDictEntry,
} from "@/lib/search/types";

const CLAUSE_DELIMITER =
  /\s*,\s*|\s+and\s+|\s+having\s+|\s+whose\s+|\s+where\s+|\s+(?=created\b)/gi;

const CONNECTOR_HINTS: OmnibarHint[] = [
  { label: "AND — add another condition", insertText: " and ", kind: "operator" },
  { label: "OR — combine values", insertText: " or ", kind: "operator" },
];

export type HintPhase = "field" | "operator" | "value" | "connector";

export type SegmentAnalysis = {
  phase: HintPhase;
  fieldKey?: string;
  operator?: FieldOperatorOption;
  valuePrefix?: string;
};

function getActiveSegment(query: string, cursor: number) {
  const before = query.slice(0, cursor);
  let segmentStart = 0;
  let match: RegExpExecArray | null;

  CLAUSE_DELIMITER.lastIndex = 0;
  while ((match = CLAUSE_DELIMITER.exec(before)) !== null) {
    segmentStart = match.index + match[0].length;
  }

  return {
    segmentStart,
    segmentText: before.slice(segmentStart),
    prefix: query.slice(0, segmentStart),
  };
}

const sortedFieldHintCache = new WeakMap<ResolvedFieldDictEntry[], OmnibarHint[]>();

function flattenFieldSynonyms(fieldDict: ResolvedFieldDictEntry[]): OmnibarHint[] {
  const cached = sortedFieldHintCache.get(fieldDict);
  if (cached) return cached;

  const hints = fieldDict
    .map((entry) => {
      const label = getFieldDisplayLabel(entry.key);
      return {
        label,
        insertText: label,
        kind: "field" as const,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  sortedFieldHintCache.set(fieldDict, hints);
  return hints;
}

function filterFieldHints(fieldHints: OmnibarHint[], token: string): OmnibarHint[] {
  const q = token.trim().toLowerCase();
  if (!q) return fieldHints;

  return fieldHints.filter(
    (hint) =>
      hint.label.toLowerCase().includes(q) || q.includes(hint.label.toLowerCase())
  );
}

function matchFieldPrefix(segment: string, fieldDict: ResolvedFieldDictEntry[]) {
  const normalized = segment.trim().toLowerCase();
  for (const entry of flattenSynonyms(fieldDict)) {
    if (normalized.startsWith(entry.synonym)) {
      return {
        field: entry.field,
        synonym: entry.synonym,
        remainder: normalized.slice(entry.synonym.length).trimStart(),
      };
    }
  }
  return null;
}

function operatorHintsForField(fieldKey: string, filterPrefix?: string): OmnibarHint[] {
  const operators = getOperatorsForField(fieldKey);
  const q = filterPrefix?.trim().toLowerCase() ?? "";

  return operators
    .filter((option) => {
      if (!q) return true;
      return option.aliases.some((alias) => alias.startsWith(q));
    })
    .map((option) => ({
      label: option.label,
      insertText: option.insertText,
      kind: "operator" as const,
    }));
}

type ParsedOperator = {
  option: FieldOperatorOption;
  valuePart: string;
};

function parseOperatorFromRemainder(
  fieldKey: string,
  remainder: string
): ParsedOperator | "partial" | null {
  const trimmed = remainder.trim();
  if (!trimmed) return null;

  const match = findOperatorOption(fieldKey, trimmed);
  if (match === "partial") return "partial";
  if (!match) return null;

  return {
    option: match,
    valuePart: getValuePartForOperator(fieldKey, trimmed),
  };
}

function getCompareTargetHints(
  fieldDict: ResolvedFieldDictEntry[],
  leftField: string,
  remainder: string
): OmnibarHint[] {
  const q = remainder.trim().toLowerCase();
  return flattenFieldSynonyms(fieldDict)
    .filter((hint) => {
      const resolved = resolveSynonymField(hint.label, fieldDict);
      if (!resolved || resolved === leftField) return false;
      if (!q) return true;
      return (
        hint.label.toLowerCase().includes(q) || q.includes(hint.label.toLowerCase())
      );
    })
    .slice(0, 8);
}

function resolveValuePrefix(segmentText: string, fieldDict: ResolvedFieldDictEntry[]): string {
  const fieldMatch = matchFieldPrefix(segmentText, fieldDict);
  if (!fieldMatch) return "";
  return getValuePartForOperator(fieldMatch.field, fieldMatch.remainder);
}

function valueHintsFromCatalog(
  options: FilterValueOption[],
  valuePrefix: string
): OmnibarHint[] {
  const q = valuePrefix.trim().toLowerCase();
  return options
    .filter((option) => {
      if (!q) return true;
      return (
        option.label.toLowerCase().includes(q) ||
        option.value.toLowerCase().includes(q)
      );
    })
    .slice(0, 10)
    .map((option) => ({
      label: option.label,
      insertText: option.value,
      kind: "value" as const,
    }));
}

export function analyzeActiveSegment(
  query: string,
  cursor: number,
  fieldDict: ResolvedFieldDictEntry[],
  valueOptions: FilterValueOption[] = []
): SegmentAnalysis {
  const { segmentText } = getActiveSegment(query, cursor);
  const trimmedSegment = segmentText.trim();

  if (!trimmedSegment) {
    return { phase: "field" };
  }

  const resolvedFieldPhrase = matchFieldPrefix(trimmedSegment, fieldDict);
  if (resolvedFieldPhrase) {
    const { field: fieldKey, remainder } = resolvedFieldPhrase;

    if (!remainder) {
      return { phase: "operator", fieldKey };
    }

    const operatorParse = parseOperatorFromRemainder(fieldKey, remainder);
    if (operatorParse === "partial") {
      return { phase: "operator", fieldKey };
    }

    if (operatorParse) {
      const { option, valuePart } = operatorParse;

      const compareMatch = valuePart.match(
        /^(?:>|>=|<=|<|is\s+more\s+than|is\s+greater\s+than|is\s+less\s+than|is\s+at\s+least|is\s+at\s+most)\s*(.*)$/i
      );
      if (compareMatch && ["GT", "GTE", "LT", "LTE"].includes(option.operator)) {
        return { phase: "value", fieldKey, operator: option, valuePrefix: compareMatch[1] ?? "" };
      }

      if (option.valueMode === "boolean" && !valuePart.trim()) {
        return { phase: "value", fieldKey, operator: option, valuePrefix: "" };
      }

      if (option.valueMode === "none" && !valuePart.trim()) {
        return { phase: "connector", fieldKey, operator: option, valuePrefix: "" };
      }

      if (valuePart.trim()) {
        const catalogHints = valueHintsFromCatalog(valueOptions, valuePart);
        if (catalogHints.length > 0) {
          return { phase: "value", fieldKey, operator: option, valuePrefix: valuePart };
        }

        if (isDraftReadyFilterClause(trimmedSegment, fieldDict)) {
          return { phase: "connector" };
        }
      }

      return { phase: "value", fieldKey, operator: option, valuePrefix: valuePart };
    }
  }

  if (isDraftReadyFilterClause(trimmedSegment, fieldDict)) {
    return { phase: "connector" };
  }

  return { phase: "field" };
}

export function getHintPhaseTitle(phase: HintPhase, scope: FilterScope): string {
  switch (phase) {
    case "field":
      return scope === "all" ? "Navigation" : "Fields";
    case "operator":
      return "Operators";
    case "value":
      return "Values";
    case "connector":
      return "Add condition";
    default:
      return "Suggestions";
  }
}

export function buildOmnibarHints(
  query: string,
  cursor: number,
  scope: FilterScope,
  fieldDict: ResolvedFieldDictEntry[],
  options?: { valueOptions?: FilterValueOption[]; analysis?: SegmentAnalysis }
): OmnibarHint[] {
  if (scope === "all") {
    return matchNavigationIndex(query).map((entry) => ({
      label: entry.label,
      insertText: entry.label,
      kind: "navigation" as const,
      href: entry.href,
    }));
  }

  if (scope === "settings") return [];

  const { segmentText } = getActiveSegment(query, cursor);
  const trimmedSegment = segmentText.trim();
  const fieldHints = flattenFieldSynonyms(fieldDict);
  const catalog = options?.valueOptions ?? [];
  const analysis =
    options?.analysis ?? analyzeActiveSegment(query, cursor, fieldDict, catalog);

  if (analysis.phase === "connector") {
    return CONNECTOR_HINTS;
  }

  if (analysis.phase === "field") {
    if (!trimmedSegment) {
      return fieldHints;
    }
    return filterFieldHints(fieldHints, trimmedSegment);
  }

  if (analysis.phase === "operator" && analysis.fieldKey) {
    const resolvedFieldPhrase = matchFieldPrefix(trimmedSegment, fieldDict);
    const remainder = resolvedFieldPhrase?.remainder ?? "";
    return operatorHintsForField(analysis.fieldKey, remainder);
  }

  if (analysis.phase === "value" && analysis.fieldKey && analysis.operator) {
    const { fieldKey, operator, valuePrefix = "" } = analysis;

    if (["GT", "GTE", "LT", "LTE"].includes(operator.operator)) {
      const compareHints = getCompareTargetHints(fieldDict, fieldKey, valuePrefix);
      if (compareHints.length > 0) {
        return compareHints;
      }
    }

    if (operator.valueMode === "boolean") {
      return [
        { label: "Active", insertText: "active", kind: "value" },
        { label: "Inactive", insertText: "inactive", kind: "value" },
      ];
    }

    if (operator.valueMode === "relative_period") {
      return valueHintsFromCatalog(getDateRelativePeriodOptions(), valuePrefix);
    }

    const catalog = options?.valueOptions ?? [];
    if (catalog.length > 0) {
      const hints = valueHintsFromCatalog(catalog, valuePrefix);
      if (hints.length > 0) return hints;
    }
    return [];
  }

  return filterFieldHints(fieldHints, trimmedSegment);
}

export function applyHintToQuery(
  query: string,
  cursor: number,
  hint: OmnibarHint,
  fieldDict: ResolvedFieldDictEntry[] = []
): { nextQuery: string; nextCursor: number } {
  const { segmentStart, segmentText } = getActiveSegment(query, cursor);
  const beforeSegment = query.slice(0, segmentStart);
  const afterCursor = query.slice(cursor);

  if (hint.kind === "navigation") {
    return { nextQuery: hint.insertText, nextCursor: hint.insertText.length };
  }

  if (hint.kind === "field") {
    const nextSegment = hint.insertText + " ";
    const nextQuery = beforeSegment + nextSegment + afterCursor;
    return { nextQuery, nextCursor: beforeSegment.length + nextSegment.length };
  }

  if (hint.kind === "value") {
    const valuePrefix = resolveValuePrefix(segmentText, fieldDict);
    let nextSegment = segmentText;

    if (valuePrefix) {
      const idx = segmentText.toLowerCase().lastIndexOf(valuePrefix.toLowerCase());
      if (idx >= 0) {
        nextSegment = segmentText.slice(0, idx) + hint.insertText;
      } else {
        nextSegment = segmentText + hint.insertText;
      }
    } else {
      nextSegment = segmentText + hint.insertText;
    }

    const nextQuery = beforeSegment + nextSegment + afterCursor;
    return {
      nextQuery,
      nextCursor: beforeSegment.length + nextSegment.length,
    };
  }

  if (hint.kind === "operator") {
    const insertText = hint.insertText;
    const needsLeadingSpace =
      segmentText.length > 0 && !/\s$/.test(segmentText) && !insertText.startsWith(" ");
    const operatorText = (needsLeadingSpace ? " " : "") + insertText;
    const nextQuery = beforeSegment + segmentText + operatorText + afterCursor;
    return {
      nextQuery,
      nextCursor: beforeSegment.length + segmentText.length + operatorText.length,
    };
  }

  const nextQuery = beforeSegment + hint.insertText + afterCursor;
  return { nextQuery, nextCursor: beforeSegment.length + hint.insertText.length };
}
