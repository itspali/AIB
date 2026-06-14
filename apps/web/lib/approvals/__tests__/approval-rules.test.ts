import { describe, expect, it } from "vitest";
import {
  defaultPoApprovalRules,
  describePoApprovalRule,
  hasEnabledPoApprovalRules,
  normalizePoApprovalRules,
  normalizePoApproverRoles,
} from "@/lib/approvals/approval-rules";

describe("normalizePoApprovalRules", () => {
  it("returns defaults when raw is missing", () => {
    const rules = normalizePoApprovalRules(undefined);
    expect(rules).toHaveLength(3);
    expect(rules.every((rule) => !rule.enabled)).toBe(true);
  });

  it("preserves enabled flags from stored settings", () => {
    const rules = normalizePoApprovalRules([
      { type: "LINE_QTY_ABOVE", enabled: true, threshold: 50 },
    ]);
    expect(rules.find((rule) => rule.type === "LINE_QTY_ABOVE")).toMatchObject({
      enabled: true,
      threshold: 50,
    });
  });
});

describe("normalizePoApproverRoles", () => {
  it("filters unknown roles", () => {
    expect(normalizePoApproverRoles(["ADMIN", "OWNER", "MANAGER"])).toEqual([
      "ADMIN",
      "MANAGER",
    ]);
  });
});

describe("describePoApprovalRule", () => {
  it("describes quantity rule", () => {
    expect(
      describePoApprovalRule({
        type: "LINE_QTY_ABOVE",
        enabled: true,
        threshold: 25,
      })
    ).toContain("25");
  });
});

describe("hasEnabledPoApprovalRules", () => {
  it("detects enabled rules", () => {
    expect(hasEnabledPoApprovalRules(defaultPoApprovalRules())).toBe(false);
    expect(
      hasEnabledPoApprovalRules([
        { type: "LINE_QTY_ABOVE", enabled: true, threshold: 1 },
      ])
    ).toBe(true);
  });
});
