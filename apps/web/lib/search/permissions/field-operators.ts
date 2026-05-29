import { getFieldMetadata } from "@/lib/search/permissions/field-metadata";
import { getFieldDisplayLabel } from "@/lib/search/permissions/field-labels";
import type { FieldMetadata, FilterOperator, FilterValueOption } from "@/lib/search/types";

export type FieldOperatorValueMode =
  | "single"
  | "multi"
  | "range"
  | "boolean"
  | "none"
  | "relative_period"
  | "datetime";

export type FieldOperatorOption = {
  id: string;
  operator: FilterOperator;
  label: string;
  insertText: string;
  aliases: string[];
  valueMode: FieldOperatorValueMode;
};

export const DATE_RELATIVE_PERIODS: FilterValueOption[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this week", label: "This week" },
  { value: "last week", label: "Last week" },
  { value: "next week", label: "Next week" },
  { value: "this month", label: "This month" },
  { value: "current month", label: "Current month" },
  { value: "last month", label: "Last month" },
  { value: "this quarter", label: "This quarter" },
  { value: "last quarter", label: "Last quarter" },
  { value: "this year", label: "This year" },
  { value: "last year", label: "Last year" },
  { value: "previous year", label: "Previous year" },
  { value: "next year", label: "Next year" },
];

function op(
  id: string,
  operator: FilterOperator,
  label: string,
  insertText: string,
  valueMode: FieldOperatorValueMode,
  aliases: string[] = []
): FieldOperatorOption {
  const normalizedAliases = new Set([label.toLowerCase(), ...aliases.map((entry) => entry.toLowerCase())]);
  return {
    id,
    operator,
    label,
    insertText,
    aliases: [...normalizedAliases].sort((a, b) => b.length - a.length),
    valueMode,
  };
}

const TEXT_FIELD_OPERATORS: FieldOperatorOption[] = [
  op("starts_with", "ILIKE", "starts with", "starts with ", "single", ["starts with"]),
  op("contains", "ILIKE", "contains", "contains ", "single", ["contains", "like"]),
  op("not_contains", "NOT_ILIKE", "not contains", "does not contain ", "single", [
    "not contains",
    "does not contain",
  ]),
  op("is_empty", "IS_NULL", "empty", "is empty", "none", ["is empty", "empty"]),
  op("is_not_empty", "IS_NOT_NULL", "not empty", "is not empty", "none", [
    "is not empty",
    "not empty",
  ]),
];

const NUMERIC_FIELD_OPERATORS: FieldOperatorOption[] = [
  op("less_than", "LT", "less than", "is less than ", "single", ["is less than", "<"]),
  op("less_than_or_equal", "LTE", "less than or equal to", "is at most ", "single", [
    "is at most",
    "less than or equal to",
    "<=",
  ]),
  op("more_than", "GT", "more than", "is more than ", "single", ["is more than", "is greater than", ">"]),
  op("more_than_or_equal", "GTE", "more than or equal to", "is at least ", "single", [
    "is at least",
    "more than or equal to",
    ">=",
  ]),
  op("between", "BETWEEN", "between", "between ", "range", ["is between"]),
  op("is_zero", "EQ", "zero", "is zero", "none", ["is zero", "zero"]),
  op("less_than_zero", "LT", "less than zero", "is less than zero", "none", [
    "is less than zero",
    "less than zero",
  ]),
  op("is_not_empty", "IS_NOT_NULL", "not empty", "is not empty", "none", [
    "is not empty",
    "not empty",
  ]),
];

const DATE_FIELD_OPERATORS: FieldOperatorOption[] = [
  op("before", "LT", "before", "before ", "datetime", ["is before"]),
  op("after", "GTE", "after", "after ", "datetime", ["is after", "on or after"]),
  op("in_period", "BETWEEN", "in", "in ", "relative_period", ["during", "within"]),
  op("between", "BETWEEN", "between", "between ", "range", ["is between"]),
  op("is_not_empty", "IS_NOT_NULL", "not empty", "is not empty", "none", [
    "is not empty",
    "not empty",
  ]),
];

const ENUM_FIELD_OPERATORS: FieldOperatorOption[] = [
  op("is", "EQ", "is", "is ", "single", ["equals", "equal to"]),
  op("is_not", "NEQ", "is not", "is not ", "single", ["not"]),
  op("is_one_of", "IN", "is one of", "is ", "multi", ["one of"]),
  op("is_empty", "IS_NULL", "empty", "is empty", "none", ["is empty", "empty"]),
  op("is_not_empty", "IS_NOT_NULL", "not empty", "is not empty", "none", [
    "is not empty",
    "not empty",
  ]),
];

const BOOLEAN_FIELD_OPERATORS: FieldOperatorOption[] = [
  op("is", "EQ", "is", "is ", "boolean", ["equals"]),
];

const IMAGE_FIELD_OPERATORS: FieldOperatorOption[] = [
  op("is_empty", "IS_NULL", "empty", "is empty", "none", ["is empty", "empty"]),
  op("is_not_empty", "IS_NOT_NULL", "not empty", "is not empty", "none", [
    "is not empty",
    "not empty",
  ]),
];

function operatorsForValueType(metadata: FieldMetadata): FieldOperatorOption[] {
  switch (metadata.valueType) {
    case "number":
      return NUMERIC_FIELD_OPERATORS;
    case "date":
      return DATE_FIELD_OPERATORS;
    case "enum":
      return ENUM_FIELD_OPERATORS;
    case "boolean":
      return BOOLEAN_FIELD_OPERATORS;
    case "image":
      return IMAGE_FIELD_OPERATORS;
    case "text":
    default:
      return TEXT_FIELD_OPERATORS;
  }
}

export function getOperatorsForField(fieldKey: string): FieldOperatorOption[] {
  const metadata = getFieldMetadata(fieldKey);
  if (metadata.allowedOperators?.length) {
    const allowed = new Set(metadata.allowedOperators);
    return operatorsForValueType(metadata).filter((entry) => allowed.has(entry.operator));
  }
  return operatorsForValueType(metadata);
}

export function getPrimaryFieldLabel(fieldKey: string): string {
  return getFieldDisplayLabel(fieldKey);
}

export function findOperatorOption(
  fieldKey: string,
  remainder: string
): FieldOperatorOption | "partial" | null {
  const trimmed = remainder.trim();
  if (!trimmed) return null;

  const operators = getOperatorsForField(fieldKey);

  for (const option of operators) {
    for (const alias of option.aliases) {
      if (trimmed.toLowerCase() === alias.toLowerCase()) {
        return option;
      }
      const prefix = `${alias} `;
      if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
        return option;
      }
    }
  }

  for (const option of operators) {
    for (const alias of option.aliases) {
      if (alias.toLowerCase().startsWith(trimmed.toLowerCase())) {
        return "partial";
      }
    }
  }

  return null;
}

export function getValuePartForOperator(fieldKey: string, remainder: string): string {
  const trimmed = remainder.trim();
  const match = findOperatorOption(fieldKey, trimmed);
  if (!match || match === "partial") return trimmed;

  for (const alias of match.aliases) {
    const prefix = `${alias} `;
    if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
      return trimmed.slice(prefix.length);
    }
    if (trimmed.toLowerCase() === alias.toLowerCase()) {
      return "";
    }
  }

  return trimmed;
}

export function getDateRelativePeriodOptions(): FilterValueOption[] {
  return DATE_RELATIVE_PERIODS;
}
