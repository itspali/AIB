import { describe, expect, it } from "vitest";
import {
  describePolicyBand,
  synthesizePoPolicyFromLegacySettings,
} from "@/lib/approvals/normalize-policy";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";

const baseSettings: ProcurementApprovalSettings = {
  require_po_approval_before_issue: true,
  po_approval_threshold_amount: 5000,
  allow_submitter_self_approve_below_threshold: true,
  po_approver_user_ids: ["11111111-1111-1111-1111-111111111111"],
};

describe("synthesizePoPolicyFromLegacySettings", () => {
  it("builds skip band and approval band from threshold", () => {
    const policy = synthesizePoPolicyFromLegacySettings(baseSettings);
    expect(policy.bands).toHaveLength(2);
    expect(policy.bands[0]?.skip).toBe(true);
    expect(policy.bands[1]?.levels?.[0]?.steps[0]?.pool).toBe("default");
    expect(policy.pools.default.user_ids).toEqual(baseSettings.po_approver_user_ids);
  });

  it("describes bands for the settings UI", () => {
    const policy = synthesizePoPolicyFromLegacySettings(baseSettings);
    expect(describePolicyBand(policy.bands[0]!)).toContain("skip");
    expect(describePolicyBand(policy.bands[1]!)).toContain("level");
  });
});
