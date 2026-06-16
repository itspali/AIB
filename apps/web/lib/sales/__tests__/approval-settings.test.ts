import { describe, expect, it } from "vitest";
import {
  canUserApproveSalesInvoices,
  canUserApproveSalesOrderAmount,
  canUserApproveSalesOrders,
  canUserApproveSalesQuotes,
  isInvoiceApprovalRequiredBeforePost,
  isQuoteApprovalRequiredBeforeConfirm,
  isSalesOrderApprovableByUser,
  isSoApprovalRequiredBeforeConfirm,
  soSelfApproveAllowed,
  type SalesApprovalSettings,
} from "@/lib/sales/approval-settings";

const baseSettings: SalesApprovalSettings = {
  require_so_approval_before_confirm: true,
  so_approval_threshold_amount: 10_000,
  allow_submitter_self_approve_below_threshold: true,
  so_approver_user_ids: ["approver-1"],
  so_approver_roles: [],
  require_quote_approval_before_confirm: false,
  quote_approval_threshold_amount: null,
  quote_approver_user_ids: [],
  require_invoice_approval_before_post: false,
  invoice_approval_threshold_amount: null,
  invoice_approver_user_ids: [],
};

describe("sales approval-settings", () => {
  it("allows configured role approvers for sales orders", () => {
    const settings: SalesApprovalSettings = {
      ...baseSettings,
      so_approver_roles: ["MANAGER"],
    };
    expect(
      canUserApproveSalesOrders("manager-1", settings, {
        isOwner: false,
        userRole: "MANAGER",
      })
    ).toBe(true);
  });

  it("limits named approvers to at-or-below threshold", () => {
    expect(
      canUserApproveSalesOrderAmount("approver-1", baseSettings, 10_001, { isOwner: false })
    ).toBe(false);
    expect(
      canUserApproveSalesOrderAmount("approver-1", baseSettings, 10_000, { isOwner: false })
    ).toBe(true);
  });

  it("requires approval above threshold even when self-approve is enabled", () => {
    expect(
      isSoApprovalRequiredBeforeConfirm(baseSettings, 10_001, "approver-1", { isOwner: false })
    ).toBe(true);
  });

  it("allows self-approval at or below threshold when enabled", () => {
    expect(
      isSalesOrderApprovableByUser(
        {
          commercial_status: "PENDING_APPROVAL",
          total_net_amount: "9999",
          approval_submitted_by: "approver-1",
        },
        "approver-1",
        baseSettings,
        { isOwner: false }
      )
    ).toBe(true);
  });

  it("blocks self-approval above threshold", () => {
    expect(soSelfApproveAllowed(baseSettings, 10_001, "approver-1", { isOwner: false })).toBe(
      false
    );
  });

  it("evaluates quote and invoice approval requirements independently", () => {
    const settings: SalesApprovalSettings = {
      ...baseSettings,
      require_quote_approval_before_confirm: true,
      quote_approval_threshold_amount: 5_000,
      quote_approver_user_ids: ["quote-approver"],
      require_invoice_approval_before_post: true,
      invoice_approval_threshold_amount: 2_000,
      invoice_approver_user_ids: ["invoice-approver"],
    };

    expect(
      isQuoteApprovalRequiredBeforeConfirm(settings, 6_000, "quote-approver", { isOwner: false })
    ).toBe(true);
    expect(
      isInvoiceApprovalRequiredBeforePost(settings, 1_000, "invoice-approver", { isOwner: false })
    ).toBe(false);
    expect(canUserApproveSalesQuotes("quote-approver", settings, { isOwner: false })).toBe(true);
    expect(canUserApproveSalesInvoices("other-user", settings, { isOwner: false })).toBe(false);
  });

  it("lets workspace owners issue quotes directly when approval is enabled", () => {
    const settings: SalesApprovalSettings = {
      ...baseSettings,
      require_quote_approval_before_confirm: true,
      quote_approval_threshold_amount: 5_000,
      quote_approver_user_ids: ["quote-approver"],
    };

    expect(
      isQuoteApprovalRequiredBeforeConfirm(settings, 14_160, "owner-1", { isOwner: true })
    ).toBe(false);
  });

  it("skips quote approval inside the configured threshold band", () => {
    const settings: SalesApprovalSettings = {
      ...baseSettings,
      require_quote_approval_before_confirm: true,
      quote_approval_threshold_amount: 5_000,
      quote_approver_user_ids: ["quote-approver"],
    };

    expect(
      isQuoteApprovalRequiredBeforeConfirm(settings, 4_000, "staff-1", { isOwner: false })
    ).toBe(false);
  });

  it("skips invoice approval when posting is not gated", () => {
    const settings: SalesApprovalSettings = {
      ...baseSettings,
      require_invoice_approval_before_post: false,
      invoice_approval_threshold_amount: 2_000,
      invoice_approver_user_ids: ["invoice-approver"],
    };

    expect(
      isInvoiceApprovalRequiredBeforePost(settings, 50_000, "staff-1", { isOwner: false })
    ).toBe(false);
  });

  it("lets workspace owners post invoices directly when approval is enabled", () => {
    const settings: SalesApprovalSettings = {
      ...baseSettings,
      require_invoice_approval_before_post: true,
      invoice_approval_threshold_amount: 2_000,
      invoice_approver_user_ids: ["invoice-approver"],
    };

    expect(
      isInvoiceApprovalRequiredBeforePost(settings, 50_000, "owner-1", { isOwner: true })
    ).toBe(false);
  });
});
