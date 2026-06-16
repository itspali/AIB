import { describe, expect, it } from "vitest";
import {
  canUserApprovePurchaseOrderAmount,
  canUserApprovePurchaseOrders,
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

  it("lets workspace owners issue purchase orders directly when approval is enabled", () => {
    expect(
      isPoApprovalRequiredBeforeIssue(baseSettings, 50_000, "owner-1", { isOwner: true })
    ).toBe(false);
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
});
