import type { QcParameterResult, QcTestParameterDef } from "@/lib/procurement/quality-inspection/types";

export function evaluateQcParameterResult(
  parameter: Pick<
    QcTestParameterDef,
    "parameter_type" | "min_value" | "max_value" | "expected_text" | "choice_options"
  >,
  measuredValue: string
): QcParameterResult {
  const raw = measuredValue.trim();
  if (raw === "") return "NA";

  switch (parameter.parameter_type) {
    case "BOOLEAN": {
      const normalized = raw.toLowerCase();
      if (normalized === "true" || normalized === "yes" || normalized === "pass" || normalized === "1") {
        return "PASS";
      }
      if (normalized === "false" || normalized === "no" || normalized === "fail" || normalized === "0") {
        return "FAIL";
      }
      return "NA";
    }
    case "NUMERIC": {
      const value = Number(raw);
      if (!Number.isFinite(value)) return "NA";
      const min = parameter.min_value != null && parameter.min_value !== "" ? Number(parameter.min_value) : null;
      const max = parameter.max_value != null && parameter.max_value !== "" ? Number(parameter.max_value) : null;
      if (min != null && Number.isFinite(min) && value < min) return "FAIL";
      if (max != null && Number.isFinite(max) && value > max) return "FAIL";
      if (min != null || max != null) return "PASS";
      return "NA";
    }
    case "TEXT": {
      if (!parameter.expected_text?.trim()) return "NA";
      return raw.toLowerCase() === parameter.expected_text.trim().toLowerCase() ? "PASS" : "FAIL";
    }
    case "CHOICE": {
      if (!parameter.choice_options.length) return "NA";
      return parameter.choice_options.includes(raw) ? "PASS" : "FAIL";
    }
    default:
      return "NA";
  }
}

export function qcInspectionBlockedByMandatoryFailures(
  parameters: QcTestParameterDef[],
  measuredByParameterId: Record<string, string>
): boolean {
  return parameters.some((parameter) => {
    if (!parameter.is_mandatory) return false;
    const measured = measuredByParameterId[parameter.id] ?? "";
    return evaluateQcParameterResult(parameter, measured) === "FAIL";
  });
}

export function qcInspectionHasUnfilledMandatory(
  parameters: QcTestParameterDef[],
  measuredByParameterId: Record<string, string>
): boolean {
  return parameters.some((parameter) => {
    if (!parameter.is_mandatory) return false;
    return (measuredByParameterId[parameter.id] ?? "").trim() === "";
  });
}
