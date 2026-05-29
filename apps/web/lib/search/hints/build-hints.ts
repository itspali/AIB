import { flattenSynonyms, resolveSynonymField } from "@/lib/search/compiler/synonyms";
import { matchNavigationIndex } from "@/lib/search/navigation-index";
import { getFieldDisplayLabel } from "@/lib/search/permissions/field-labels";
import type { FilterScope, OmnibarHint, ResolvedFieldDictEntry } from "@/lib/search/types";

const CLAUSE_DELIMITER =
  /\s*,\s*|\s+and\s+|\s+having\s+|\s+whose\s+|\s+where\s+|\s+(?=created\b)/gi;

const OPERATOR_HINTS: OmnibarHint[] = [
  { label: "contains", insertText: "contains ", kind: "operator" },
  { label: "is", insertText: "is ", kind: "operator" },
  { label: "like", insertText: "like ", kind: "operator" },
  { label: ">", insertText: "> ", kind: "operator" },
  { label: "is more than", insertText: "is more than ", kind: "operator" },
  { label: "and", insertText: " and ", kind: "operator" },
  { label: "having", insertText: " having ", kind: "operator" },
];

const ITEMS_EXAMPLES: OmnibarHint[] = [
  { label: "name contains …", insertText: "name contains ", kind: "example" },
  {
    label: "purchase price > sales price",
    insertText: "purchase price > sales price",
    kind: "example",
  },
  {
    label: "selling price >= 100",
    insertText: "selling price >= 100",
    kind: "example",
  },
  {
    label: "selling price between 500 and 1000",
    insertText: "selling price between 500 and 1000",
    kind: "example",
  },
  { label: "category …", insertText: "category ", kind: "example" },
  { label: "sku …", insertText: "sku ", kind: "example" },
];

const LOCATIONS_EXAMPLES: OmnibarHint[] = [
  { label: "name contains …", insertText: "name contains ", kind: "example" },
  { label: "city …", insertText: "city ", kind: "example" },
  { label: "code …", insertText: "code ", kind: "example" },
];

const CATEGORIES_EXAMPLES: OmnibarHint[] = [
  { label: "name contains …", insertText: "name contains ", kind: "example" },
  { label: "category …", insertText: "category ", kind: "example" },
];

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

function flattenFieldSynonyms(fieldDict: ResolvedFieldDictEntry[]): OmnibarHint[] {
  return fieldDict
    .map((entry) => {
      const label = getFieldDisplayLabel(entry.key);
      return {
        label,
        insertText: label,
        kind: "field" as const,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function filterFieldHints(
  fieldHints: OmnibarHint[],
  token: string
): OmnibarHint[] {
  const q = token.trim().toLowerCase();
  if (!q) return fieldHints.slice(0, 8);

  return fieldHints
    .filter(
      (hint) =>
        hint.label.toLowerCase().includes(q) || q.includes(hint.label.toLowerCase())
    )
    .slice(0, 8);
}

function matchFieldPrefix(segment: string, fieldDict: ResolvedFieldDictEntry[]) {
  const normalized = segment.trim().toLowerCase();
  for (const entry of flattenSynonyms(fieldDict)) {
    if (normalized.startsWith(entry.synonym)) {
      return {
        field: entry.field,
        synonym: entry.synonym,
        remainder: normalized.slice(entry.synonym.length).trim(),
      };
    }
  }
  return null;
}

function getExamplesForScope(scope: FilterScope): OmnibarHint[] {
  switch (scope) {
    case "items":
      return ITEMS_EXAMPLES;
    case "locations":
      return LOCATIONS_EXAMPLES;
    case "categories":
      return CATEGORIES_EXAMPLES;
    default:
      return [];
  }
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
    .slice(0, 6);
}

export function buildOmnibarHints(
  query: string,
  cursor: number,
  scope: FilterScope,
  fieldDict: ResolvedFieldDictEntry[]
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

  if (!trimmedSegment) {
    return getExamplesForScope(scope).slice(0, 6);
  }

  const resolvedFieldPhrase = matchFieldPrefix(trimmedSegment, fieldDict);
  if (resolvedFieldPhrase) {
    const { field: resolvedField, remainder } = resolvedFieldPhrase;

    if (!remainder) {
      return OPERATOR_HINTS.slice(0, 8);
    }

    const compareMatch = remainder.match(
      /^(?:>|>=|<=|<|is\s+more\s+than|is\s+greater\s+than|is\s+less\s+than|is\s+at\s+least|is\s+at\s+most)\s*(.*)$/i
    );
    if (compareMatch) {
      return getCompareTargetHints(fieldDict, resolvedField, compareMatch[1] ?? "");
    }

    if (/^(?:contains|like|includes|is|starts\s+with)\b/i.test(remainder)) {
      return [];
    }

    return filterFieldHints(fieldHints, trimmedSegment);
  }

  return filterFieldHints(fieldHints, trimmedSegment);
}

export function applyHintToQuery(
  query: string,
  cursor: number,
  hint: OmnibarHint
): { nextQuery: string; nextCursor: number } {
  const { segmentStart, segmentText } = getActiveSegment(query, cursor);
  const beforeSegment = query.slice(0, segmentStart);
  const afterCursor = query.slice(cursor);

  if (hint.kind === "example") {
    const nextQuery = beforeSegment + hint.insertText;
    return { nextQuery, nextCursor: nextQuery.length };
  }

  if (hint.kind === "navigation") {
    return { nextQuery: hint.insertText, nextCursor: hint.insertText.length };
  }

  if (hint.kind === "field") {
    const nextSegment = hint.insertText + " ";
    const nextQuery = beforeSegment + nextSegment + afterCursor;
    return { nextQuery, nextCursor: beforeSegment.length + nextSegment.length };
  }

  if (hint.kind === "operator") {
    const trimmed = segmentText.trimEnd();
    const needsSpace = trimmed.length > 0 && !/\s$/.test(segmentText);
    const operatorText = (needsSpace ? " " : "") + hint.insertText;
    const nextQuery =
      beforeSegment + segmentText + operatorText + afterCursor;
    return {
      nextQuery,
      nextCursor: beforeSegment.length + segmentText.length + operatorText.length,
    };
  }

  const nextQuery = beforeSegment + hint.insertText + afterCursor;
  return { nextQuery, nextCursor: beforeSegment.length + hint.insertText.length };
}
