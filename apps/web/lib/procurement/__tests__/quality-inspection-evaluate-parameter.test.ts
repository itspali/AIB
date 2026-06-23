import { describe, expect, it } from "vitest";
import {
  evaluateQcParameterResult,
  qcInspectionBlockedByMandatoryFailures,
  qcInspectionHasUnfilledMandatory,
} from "@/lib/procurement/quality-inspection/evaluate-parameter";
import type { QcTestParameterDef } from "@/lib/procurement/quality-inspection/types";

function parameter(
  partial: Partial<QcTestParameterDef> & Pick<QcTestParameterDef, "id" | "name" | "parameter_type">
): QcTestParameterDef {
  return {
    min_value: null,
    max_value: null,
    expected_text: null,
    choice_options: [],
    is_mandatory: false,
    sort_order: 0,
    ...partial,
  };
}

describe("evaluateQcParameterResult", () => {
  it("evaluates numeric range", () => {
    expect(
      evaluateQcParameterResult(
        parameter({
          id: "p1",
          name: "Weight",
          parameter_type: "NUMERIC",
          min_value: "10",
          max_value: "20",
        }),
        "15"
      )
    ).toBe("PASS");
    expect(
      evaluateQcParameterResult(
        parameter({
          id: "p1",
          name: "Weight",
          parameter_type: "NUMERIC",
          min_value: "10",
          max_value: "20",
        }),
        "25"
      )
    ).toBe("FAIL");
  });

  it("evaluates boolean tokens", () => {
    expect(
      evaluateQcParameterResult(
        parameter({ id: "p1", name: "Visual", parameter_type: "BOOLEAN" }),
        "pass"
      )
    ).toBe("PASS");
  });
});

describe("qcInspectionBlockedByMandatoryFailures", () => {
  it("blocks when a mandatory parameter fails", () => {
    const parameters = [
      parameter({
        id: "p1",
        name: "Visual",
        parameter_type: "BOOLEAN",
        is_mandatory: true,
      }),
    ];
    expect(
      qcInspectionBlockedByMandatoryFailures(parameters, { p1: "fail" })
    ).toBe(true);
  });
});

describe("qcInspectionHasUnfilledMandatory", () => {
  it("detects missing mandatory values", () => {
    const parameters = [
      parameter({
        id: "p1",
        name: "Visual",
        parameter_type: "BOOLEAN",
        is_mandatory: true,
      }),
    ];
    expect(qcInspectionHasUnfilledMandatory(parameters, {})).toBe(true);
    expect(qcInspectionHasUnfilledMandatory(parameters, { p1: "pass" })).toBe(false);
  });
});
