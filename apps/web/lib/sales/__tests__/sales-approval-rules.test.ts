import { describe, expect, it } from "vitest";
import {
  defaultSalesApprovalRules,
  describeSalesApprovalRule,
  hasEnabledSalesApprovalRules,
  migrateLegacySalesApprovalRules,
  normalizeSalesApprovalRules,
} from "@/lib/sales/sales-approval-rules";

describe("normalizeSalesApprovalRules", () => {
  it("returns defaults when raw is missing", () => {
    const rules = normalizeSalesApprovalRules(undefined);
    expect(rules).toHaveLength(3);
    expect(rules.every((rule) => !rule.enabled)).toBe(true);
  });

  it("preserves enabled flags from stored settings", () => {
    const rules = normalizeSalesApprovalRules([
      { type: "LINE_DISCOUNT_ABOVE", enabled: true, threshold: 15 },
    ]);
    expect(rules.find((rule) => rule.type === "LINE_DISCOUNT_ABOVE")).toMatchObject({
      enabled: true,
      threshold: 15,
    });
  });
});

describe("migrateLegacySalesApprovalRules", () => {
  it("replaces legacy procurement rule types with sales defaults", () => {
    const rules = migrateLegacySalesApprovalRules([
      { type: "LINE_PRICE_ABOVE_SUPPLIER", enabled: true, tolerance_percent: 5 },
      { type: "LINE_PRICE_ABOVE_CATALOG", enabled: false },
    ]);
    expect(rules).toHaveLength(3);
    expect(rules.every((rule) => !rule.enabled)).toBe(true);
    expect(rules.map((rule) => rule.type)).toEqual([
      "LINE_QTY_ABOVE",
      "LINE_PRICE_BELOW_LIST",
      "LINE_DISCOUNT_ABOVE",
    ]);
  });

  it("keeps sales rule payloads when present", () => {
    const rules = migrateLegacySalesApprovalRules([
      { type: "LINE_QTY_ABOVE", enabled: true, threshold: 42 },
    ]);
    expect(rules.find((rule) => rule.type === "LINE_QTY_ABOVE")).toMatchObject({
      enabled: true,
      threshold: 42,
    });
  });
});

describe("describeSalesApprovalRule", () => {
  it("describes quantity rule", () => {
    expect(
      describeSalesApprovalRule({
        type: "LINE_QTY_ABOVE",
        enabled: true,
        threshold: 25,
      })
    ).toContain("25");
  });

  it("describes discount rule", () => {
    expect(
      describeSalesApprovalRule({
        type: "LINE_DISCOUNT_ABOVE",
        enabled: true,
        threshold: 12,
      })
    ).toContain("12%");
  });

  it("describes list price rule with tolerance", () => {
    expect(
      describeSalesApprovalRule({
        type: "LINE_PRICE_BELOW_LIST",
        enabled: true,
        tolerance_percent: 5,
      })
    ).toContain("5%");
  });
});

describe("hasEnabledSalesApprovalRules", () => {
  it("detects enabled rules", () => {
    expect(hasEnabledSalesApprovalRules(defaultSalesApprovalRules())).toBe(false);
    expect(
      hasEnabledSalesApprovalRules([
        { type: "LINE_PRICE_BELOW_LIST", enabled: true, tolerance_percent: 0 },
      ])
    ).toBe(true);
  });
});
