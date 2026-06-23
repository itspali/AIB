import { describe, expect, it } from "vitest";
import {
  isDocumentApprovalRequired,
  resolveApprovalBand,
  resolveDocumentApprovalPolicy,
  submitterSelfApproveAllowed,
} from "@/lib/approvals/approval-required-gate";

describe("approval-required-gate", () => {
  it("requires approval above threshold for workspace owners", () => {
    expect(
      isDocumentApprovalRequired({
        requireEnabled: true,
        totalNetAmount: 50_000,
        userId: "owner-1",
        isOwner: true,
        allowSubmitterSelfApprove: false,
        thresholdAmount: 5_000,
        approverUserIds: [],
      })
    ).toBe(true);
  });

  it("skips approval for amounts inside a skip band", () => {
    const policy = resolveDocumentApprovalPolicy({
      thresholdAmount: 10_000,
      allowSubmitterSelfApprove: true,
      approverUserIds: ["approver-1"],
    });

    expect(resolveApprovalBand(9_999, policy)?.skip).toBe(true);
    expect(
      isDocumentApprovalRequired({
        requireEnabled: true,
        totalNetAmount: 9_999,
        userId: "staff-1",
        isOwner: false,
        allowSubmitterSelfApprove: true,
        thresholdAmount: 10_000,
        approverUserIds: ["approver-1"],
      })
    ).toBe(false);
  });

  it("requires approval above threshold for non-exempt users", () => {
    expect(
      isDocumentApprovalRequired({
        requireEnabled: true,
        totalNetAmount: 10_001,
        userId: "approver-1",
        isOwner: false,
        allowSubmitterSelfApprove: true,
        thresholdAmount: 10_000,
        approverUserIds: ["approver-1"],
      })
    ).toBe(true);
  });

  it("forces approval when business rules match even below threshold", () => {
    expect(
      isDocumentApprovalRequired({
        requireEnabled: true,
        totalNetAmount: 500,
        userId: "owner-1",
        isOwner: true,
        allowSubmitterSelfApprove: true,
        thresholdAmount: 10_000,
        approverUserIds: ["owner-1"],
        rulesRequireApproval: true,
      })
    ).toBe(true);
  });

  it("allows named approvers to self-approve only at or below threshold", () => {
    expect(
      submitterSelfApproveAllowed({
        totalNetAmount: 10_000,
        userId: "approver-1",
        isOwner: false,
        allowSubmitterSelfApprove: true,
        thresholdAmount: 10_000,
        approverUserIds: ["approver-1"],
      })
    ).toBe(true);
    expect(
      submitterSelfApproveAllowed({
        totalNetAmount: 10_001,
        userId: "approver-1",
        isOwner: false,
        allowSubmitterSelfApprove: true,
        thresholdAmount: 10_000,
        approverUserIds: ["approver-1"],
      })
    ).toBe(false);
  });
});
