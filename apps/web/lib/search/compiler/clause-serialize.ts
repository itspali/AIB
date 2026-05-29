import { getPrimaryFieldLabel } from "@/lib/search/permissions/field-operators";
import type { CriterionDraft, CriterionDraftPart, FilterOperator } from "@/lib/search/types";

function formatValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(" or ");
  }
  if (typeof value === "boolean") {
    return value ? "active" : "inactive";
  }
  return String(value);
}

function serializeOperatorPhrase(fieldLabel: string, operator: FilterOperator, value: unknown): string {
  const formatted = formatValue(value);

  switch (operator) {
    case "ILIKE": {
      const raw = String(value);
      if (raw.startsWith("^")) {
        return `${fieldLabel} starts with ${raw.slice(1)}`;
      }
      return `${fieldLabel} contains ${formatted}`;
    }
    case "IN":
      return `${fieldLabel} is ${formatted}`;
    case "BETWEEN": {
      if (!Array.isArray(value) || value.length !== 2) {
        return `${fieldLabel} is ${formatted}`;
      }
      return `${fieldLabel} between ${value[0]} and ${value[1]}`;
    }
    case "GT":
      return `${fieldLabel} > ${formatted}`;
    case "GTE":
      return `${fieldLabel} >= ${formatted}`;
    case "LT":
      return `${fieldLabel} < ${formatted}`;
    case "LTE":
      return `${fieldLabel} <= ${formatted}`;
    case "EQ":
      if (typeof value === "boolean") {
        return value ? "active" : "inactive";
      }
      return `${fieldLabel} is ${formatted}`;
    default:
      return `${fieldLabel} is ${formatted}`;
  }
}

export function serializePredicatePart(fieldKey: string, part: CriterionDraftPart): string {
  const fieldLabel = getPrimaryFieldLabel(fieldKey);
  return serializeOperatorPhrase(fieldLabel, part.operator, part.value);
}

export function serializeCriterionDraft(draft: CriterionDraft): string {
  if (!draft.parts.length) return "";
  return draft.parts.map((part) => serializePredicatePart(draft.field, part)).join(" and ");
}

export function serializePredicate(
  fieldKey: string,
  operator: FilterOperator,
  value: unknown
): string {
  return serializePredicatePart(fieldKey, { operator, value });
}
