import { describe, expect, it } from "vitest";
import {
  canUserApprovePurchaseOrderAmount,
  canUserApprovePurchaseOrders,
  canUserManuallyIssueApprovedPo,
  isPoApprovalRequiredBeforeIssue,
  isPurchaseOrderApprovableByUser,
  poSelfApproveAllowed,
  type ProcurementApprovalSettings,
} from "@/lib/procurement/approval-settings";

const baseSettings: ProcurementApprovalSettings = {
  require_po_approval_before_issue: true,
  po_approval_threshold_amount: 10_000,
  allow_submitter_self_approve_below_threshold: true,
  po_approver_user_ids: ["approver-1"],
};

describe("approval-settings", () => {
  it("allows configured role approvers", () => {
    const settings: ProcurementApprovalSettings = {
      ...baseSettings,
      po_approver_roles: ["MANAGER"],
    };
    expect(
      canUserApprovePurchaseOrders("manager-1", settings, {
        isOwner: false,
        userRole: "MANAGER",
      })
    ).toBe(true);
  });

  it("treats workspace owners as super approvers for any amount", () => {
    expect(
      canUserApprovePurchaseOrderAmount("owner-1", baseSettings, 50_000, { isOwner: true })
    ).toBe(true);
    expect(canUserApprovePurchaseOrders("owner-1", baseSettings, { isOwner: true })).toBe(true);
  });

  it("limits named approvers to at-or-below threshold", () => {
    expect(
      canUserApprovePurchaseOrderAmount("approver-1", baseSettings, 9_999, { isOwner: false })
    ).toBe(true);
    expect(
      canUserApprovePurchaseOrderAmount("approver-1", baseSettings, 10_000, { isOwner: false })
    ).toBe(true);
    expect(
      canUserApprovePurchaseOrderAmount("approver-1", baseSettings, 10_001, { isOwner: false })
    ).toBe(false);
  });

  it("allows named approvers for any amount when threshold is unset", () => {
    const settings = { ...baseSettings, po_approval_threshold_amount: null };
    expect(
      canUserApprovePurchaseOrderAmount("approver-1", settings, 99_999, { isOwner: false })
    ).toBe(true);
  });

  it("requires approval above threshold even when self-approve is enabled", () => {
    expect(
      isPoApprovalRequiredBeforeIssue(baseSettings, 10_001, "approver-1", { isOwner: false })
    ).toBe(true);
  });

  it("requires workspace owners to submit for approval above threshold", () => {
    expect(
      isPoApprovalRequiredBeforeIssue(baseSettings, 50_000, "owner-1", { isOwner: true })
    ).toBe(true);
  });

  it("only treats pending approval orders as bulk approvable", () => {
    expect(
      isPurchaseOrderApprovableByUser(
        { document_status: "PENDING_APPROVAL", total_net_amount: "5000" },
        "approver-1",
        baseSettings,
        { isOwner: false }
      )
    ).toBe(true);
    expect(
      isPurchaseOrderApprovableByUser(
        { document_status: "DRAFT", total_net_amount: "5000" },
        "approver-1",
        baseSettings,
        { isOwner: false }
      )
    ).toBe(false);
    expect(
      isPurchaseOrderApprovableByUser(
        { document_status: "PENDING_APPROVAL", total_net_amount: "50000" },
        "approver-1",
        baseSettings,
        { isOwner: false }
      )
    ).toBe(false);
  });

  it("blocks self-approval above threshold even when self-approve is enabled", () => {
    expect(
      poSelfApproveAllowed(baseSettings, 10_001, "approver-1", { isOwner: false })
    ).toBe(false);
    expect(
      isPurchaseOrderApprovableByUser(
        {
          document_status: "PENDING_APPROVAL",
          total_net_amount: "10001",
          approval_submitted_by: "approver-1",
        },
        "approver-1",
        baseSettings,
        { isOwner: false }
      )
    ).toBe(false);
  });

  it("allows owners to approve their own submissions above threshold", () => {
    expect(
      isPurchaseOrderApprovableByUser(
        {
          document_status: "PENDING_APPROVAL",
          total_net_amount: "50000",
          approval_submitted_by: "owner-1",
        },
        "owner-1",
        baseSettings,
        { isOwner: true }
      )
    ).toBe(true);
  });

  it("allows self-approval at or below threshold when enabled", () => {
    expect(
      isPurchaseOrderApprovableByUser(
        {
          document_status: "PENDING_APPROVAL",
          total_net_amount: "9999",
          approval_submitted_by: "approver-1",
        },
        "approver-1",
        baseSettings,
        { isOwner: false }
      )
    ).toBe(true);
  });

  it("blocks approve actions when fully approved and awaiting manual issue", () => {
    expect(
      isPurchaseOrderApprovableByUser(
        {
          document_status: "PENDING_APPROVAL",
          total_net_amount: "17700",
          approval_request_status: "APPROVED",
          approval_run_status: "APPROVED",
        },
        "approver-1",
        baseSettings,
        { isOwner: false }
      )
    ).toBe(false);
  });
});

describe("manual issue after approval", () => {
  const manualSettings: ProcurementApprovalSettings = {
    ...baseSettings,
    po_auto_issue_after_approval: false,
    po_manual_issue_actor: "submitter",
  };

  const approvedOrder = {
    document_status: "PENDING_APPROVAL",
    approval_submitted_by: "buyer-1",
    approval_request_status: "APPROVED",
    approval_run_status: "APPROVED",
  };

  it("allows submitter to issue when manual mode is on", () => {
    expect(
      canUserManuallyIssueApprovedPo(approvedOrder, "buyer-1", manualSettings, {
        isOwner: false,
        editAccessGranted: true,
      })
    ).toBe(true);
  });

  it("blocks non-submitter when actor is submitter", () => {
    expect(
      canUserManuallyIssueApprovedPo(approvedOrder, "other-1", manualSettings, {
        isOwner: false,
        editAccessGranted: true,
      })
    ).toBe(false);
  });

  it("allows editors when actor is editors", () => {
    expect(
      canUserManuallyIssueApprovedPo(
        approvedOrder,
        "other-1",
        { ...manualSettings, po_manual_issue_actor: "editors" },
        { isOwner: false, editAccessGranted: true }
      )
    ).toBe(true);
  });

  it("allows owner when actor is submitter_or_owner", () => {
    expect(
      canUserManuallyIssueApprovedPo(
        approvedOrder,
        "owner-1",
        { ...manualSettings, po_manual_issue_actor: "submitter_or_owner" },
        { isOwner: true, editAccessGranted: true }
      )
    ).toBe(true);
  });
});
