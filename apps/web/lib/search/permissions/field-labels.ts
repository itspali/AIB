import { NUMERIC_FILTER_FIELDS, SEARCH_FIELD_REGISTRY } from "@/lib/search/permissions/field-registry";
import type { FilterOperator } from "@/lib/search/types";

const FIELD_COMPARE_OPERATOR_LABELS: Partial<Record<FilterOperator, string>> = {
  FIELD_GT: ">",
  FIELD_GTE: ">=",
  FIELD_LT: "<",
  FIELD_LTE: "<=",
};

const PREDICATE_COMPARE_OPERATOR_LABELS: Partial<Record<FilterOperator, string>> = {
  GT: ">",
  GTE: ">=",
  LT: "<",
  LTE: "<=",
};

/** Internal keys that may appear in AST but are not primary registry entries. */
const FIELD_DISPLAY_ALIASES: Record<string, string> = {
  category_id: "category",
};

/** Human-readable label for a registry field key (chips, tips). */
export function getFieldDisplayLabel(fieldKey: string): string {
  const alias = FIELD_DISPLAY_ALIASES[fieldKey];
  if (alias) return alias;

  const entry = SEARCH_FIELD_REGISTRY.find((field) => field.key === fieldKey);
  if (!entry) {
    return fieldKey.replace(/_/g, " ");
  }

  const spacedSynonym = entry.synonyms.find(
    (synonym) => synonym.includes(" ") && !synonym.includes("_")
  );
  if (spacedSynonym) return spacedSynonym;

  const plainSynonym = entry.synonyms.find((synonym) => !synonym.includes("_"));
  if (plainSynonym) return plainSynonym;

  return fieldKey.replace(/_/g, " ");
}

export function getFieldCompareOperatorLabel(operator: FilterOperator): string {
  return FIELD_COMPARE_OPERATOR_LABELS[operator] ?? operator.replace("FIELD_", "").toLowerCase();
}

export function getPredicateCompareOperatorLabel(operator: FilterOperator): string {
  return PREDICATE_COMPARE_OPERATOR_LABELS[operator] ?? operator.toLowerCase();
}

/** Fields compared as booleans in native filters. */
export const BOOLEAN_FILTER_FIELDS = new Set<string>(["is_active"]);

export function isBooleanFilterField(fieldKey: string): boolean {
  return BOOLEAN_FILTER_FIELDS.has(fieldKey);
}

export function isNumericFilterField(fieldKey: string): boolean {
  return NUMERIC_FILTER_FIELDS.has(fieldKey);
}
