import {
  getFieldCompareOperatorLabel,
  getFieldDisplayLabel,
  getPredicateCompareOperatorLabel,
  isBooleanFilterField,
  isNumericFilterField,
} from "@/lib/search/permissions/field-labels";
import type { AstClause } from "@/lib/search/types";

export type ClauseLabelPart =
  | { kind: "field"; text: string }
  | { kind: "operator"; text: string }
  | { kind: "value"; text: string };

function fieldPart(fieldKey: string): ClauseLabelPart {
  return { kind: "field", text: getFieldDisplayLabel(fieldKey) };
}

function operatorPart(text: string): ClauseLabelPart {
  return { kind: "operator", text };
}

function valuePart(text: string): ClauseLabelPart {
  return { kind: "value", text };
}

export function clauseToLabelParts(clause: AstClause): ClauseLabelPart[] {
  if (clause.kind === "text") {
    return [valuePart(clause.value)];
  }

  if (clause.kind === "field_compare") {
    return [
      fieldPart(clause.left),
      operatorPart(getFieldCompareOperatorLabel(clause.operator)),
      fieldPart(clause.right),
    ];
  }

  if (clause.kind === "predicate") {
    if (clause.operator === "IN" && Array.isArray(clause.value)) {
      return [
        fieldPart(clause.field),
        operatorPart("in"),
        valuePart(clause.value.join(", ")),
      ];
    }

    if (clause.operator === "BETWEEN" && Array.isArray(clause.value)) {
      if (isNumericFilterField(clause.field)) {
        return [
          fieldPart(clause.field),
          operatorPart("between"),
          valuePart(String(clause.value[0])),
          operatorPart("and"),
          valuePart(String(clause.value[1])),
        ];
      }
      return [
        fieldPart(clause.field),
        operatorPart("between"),
        valuePart(String(clause.value[0])),
        operatorPart("–"),
        valuePart(String(clause.value[1])),
      ];
    }

    if (clause.operator === "ILIKE") {
      const raw = String(clause.value);
      if (raw.startsWith("^")) {
        return [
          fieldPart(clause.field),
          operatorPart("starts with"),
          valuePart(raw.slice(1)),
        ];
      }
      return [
        fieldPart(clause.field),
        operatorPart("contains"),
        valuePart(raw),
      ];
    }

    if (clause.operator === "EQ") {
      if (isBooleanFilterField(clause.field)) {
        return [
          fieldPart(clause.field),
          operatorPart("is"),
          valuePart(clause.value === true || clause.value === "true" ? "active" : "inactive"),
        ];
      }
      return [
        fieldPart(clause.field),
        operatorPart("is"),
        valuePart(String(clause.value)),
      ];
    }

    if (clause.operator === "GTE") {
      if (isNumericFilterField(clause.field)) {
        return [
          fieldPart(clause.field),
          operatorPart(">="),
          valuePart(String(clause.value)),
        ];
      }
      return [
        fieldPart(clause.field),
        operatorPart("on or after"),
        valuePart(String(clause.value)),
      ];
    }

    if (clause.operator === "LTE") {
      if (isNumericFilterField(clause.field)) {
        return [
          fieldPart(clause.field),
          operatorPart("<="),
          valuePart(String(clause.value)),
        ];
      }
      return [
        fieldPart(clause.field),
        operatorPart("on or before"),
        valuePart(String(clause.value)),
      ];
    }

    if (clause.operator === "GT" || clause.operator === "LT") {
      return [
        fieldPart(clause.field),
        operatorPart(getPredicateCompareOperatorLabel(clause.operator)),
        valuePart(String(clause.value)),
      ];
    }

    return [
      fieldPart(clause.field),
      operatorPart(clause.operator.toLowerCase()),
      valuePart(String(clause.value)),
    ];
  }

  return [];
}

export function clauseToLabel(clause: AstClause): string {
  return clauseToLabelParts(clause)
    .map((part) => part.text)
    .join(" ");
}
