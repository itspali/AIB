import { describe, expect, it } from "vitest";
import {
  buildApprovalPlainSummary,
  hasCustomWorkflow,
  resolveApprovalScopeMode,
  workflowBandsFromSettings,
} from "@/lib/approvals/plain-summary";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";

const baseSettings: ProcurementApprovalSettings = {
  require_po_approval_before_issue: true,
  po_approval_threshold_amount: null,
  allow_submitter_self_approve_below_threshold: false,
  po_approver_user_ids: ["user-1"],
  po_approver_roles: [],
  po_approval_rules: [],
  po_approval_bands: undefined,
  po_approver_pools: undefined,
};

describe("resolveApprovalScopeMode", () => {
  it("returns all when no threshold or skip band", () => {
    expect(resolveApprovalScopeMode(baseSettings)).toBe("all");
  });

  it("returns small_orders_exempt when threshold is set", () => {
    expect(
      resolveApprovalScopeMode({ ...baseSettings, po_approval_threshold_amount: 5000 })
    ).toBe("small_orders_exempt");
  });

  it("returns small_orders_exempt when a skip band exists", () => {
    expect(
      resolveApprovalScopeMode({
        ...baseSettings,
        po_approval_bands: [{ min_amount: 0, max_amount: 1000, skip: true }],
      })
    ).toBe("small_orders_exempt");
  });
});

describe("buildApprovalPlainSummary", () => {
  it("describes disabled approval", () => {
    const lines = buildApprovalPlainSummary({
      enabled: false,
      scopeMode: "all",
      thresholdAmount: null,
      allowSelfApproveSmall: false,
      approverCount: 0,
      extraStepCount: 1,
    });
    expect(lines[0]).toContain("issued");
    expect(lines.some((line) => line.includes("No approval"))).toBe(true);
  });

  it("mentions exempt amount when small orders skip approval", () => {
    const lines = buildApprovalPlainSummary({
      enabled: true,
      scopeMode: "small_orders_exempt",
      thresholdAmount: 10000,
      allowSelfApproveSmall: true,
      approverCount: 2,
      extraStepCount: 1,
    });
    expect(lines.some((line) => line.includes("10,000"))).toBe(true);
    expect(lines.some((line) => line.includes("their own"))).toBe(true);
  });
});

describe("hasCustomWorkflow", () => {
  it("is false for default legacy settings", () => {
    expect(hasCustomWorkflow(baseSettings)).toBe(false);
  });

  it("is true when multiple levels exist", () => {
    expect(
      hasCustomWorkflow({
        ...baseSettings,
        po_approval_bands: [
          {
            min_amount: 0,
            max_amount: null,
            levels: [
              { steps: [{ label: "First", quorum: "ANY", pool: "default" }] },
              { steps: [{ label: "Second", quorum: "ANY", pool: "default" }] },
            ],
          },
        ],
      })
    ).toBe(true);
  });
});

describe("workflowBandsFromSettings", () => {
  it("strips skip bands from stored policy", () => {
    const bands = workflowBandsFromSettings({
      ...baseSettings,
      po_approval_bands: [
        { min_amount: 0, max_amount: 5000, skip: true },
        {
          min_amount: 5000,
          max_amount: null,
          levels: [{ steps: [{ label: "Approvers", quorum: "ANY", pool: "default" }] }],
        },
      ],
    });
    expect(bands).toHaveLength(1);
    expect(bands[0]?.skip).toBeUndefined();
  });
});
