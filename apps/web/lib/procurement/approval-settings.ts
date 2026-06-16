import { isDocumentApprovalRequired } from "@/lib/approvals/approval-required-gate";
import type { ApprovalPolicyBand, ApprovalApproverPool } from "@/lib/approvals/policy-types";
import type { PoApprovalRule, PoApproverRole } from "@/lib/approvals/approval-rules";
import type { PoWorkflowTemplate } from "@/lib/approvals/workflow-templates";

export type ProcurementApprovalSettings = {
  require_po_approval_before_issue: boolean;
  po_approval_threshold_amount: number | null;
  allow_submitter_self_approve_below_threshold: boolean;
  po_approver_user_ids: string[];
  po_approver_roles?: PoApproverRole[];
  po_approval_rules?: PoApprovalRule[];
  po_workflow_template?: PoWorkflowTemplate;
  po_finance_approver_user_ids?: string[];
  /** Multi-threshold bands with levels/steps; when set, overrides legacy threshold synthesis. */
  po_approval_bands?: ApprovalPolicyBand[];
  po_approver_pools?: Record<string, ApprovalApproverPool>;
  /** When true, pool/role approvers must access the PO destination location. Owners/admins stay global. */
  po_approval_respect_destination_location?: boolean;
  /** Hours after a step opens before in-app reminders repeat (default 24). Set 0 to disable. */
  po_approval_reminder_hours?: number | null;
  /** Hours before owners are notified; null disables escalation. */
  po_approval_escalation_hours?: number | null;
};

export function canUserApprovePurchaseOrders(
  userId: string,
  settings: ProcurementApprovalSettings,
  options: { isOwner: boolean; userRole?: PoApproverRole | "OWNER" | "STAFF" | null }
): boolean {
  if (options.isOwner) return true;
  if (
    options.userRole &&
    settings.po_approver_roles?.includes(options.userRole as PoApproverRole)
  ) {
    return true;
  }
  return settings.po_approver_user_ids.includes(userId);
}

/** Workspace owners may approve any amount; named approvers only at or below threshold. */
export function canUserApprovePurchaseOrderAmount(
  userId: string,
  settings: ProcurementApprovalSettings,
  totalNetAmount: number,
  options: { isOwner: boolean; userRole?: PoApproverRole | "OWNER" | "STAFF" | null }
): boolean {
  if (options.isOwner) return true;

  const isRoleApprover =
    options.userRole != null &&
    settings.po_approver_roles?.includes(options.userRole as PoApproverRole);

  if (!settings.po_approver_user_ids.includes(userId) && !isRoleApprover) return false;

  const threshold = settings.po_approval_threshold_amount;
  if (threshold == null || !Number.isFinite(threshold)) return true;

  return Number.isFinite(totalNetAmount) && totalNetAmount <= threshold;
}

/** Mirrors `private.po_self_approve_allowed` — only below threshold when enabled. */
export function poSelfApproveAllowed(
  settings: ProcurementApprovalSettings,
  totalNetAmount: number,
  userId: string,
  options: { isOwner: boolean }
): boolean {
  if (options.isOwner) return true;
  if (!settings.allow_submitter_self_approve_below_threshold) return false;
  if (!canUserApprovePurchaseOrders(userId, settings, options)) return false;

  const threshold = settings.po_approval_threshold_amount;
  if (threshold == null || !Number.isFinite(threshold)) return false;

  return Number.isFinite(totalNetAmount) && totalNetAmount <= threshold;
}

export function describePurchaseOrderSelfApprovalBlocker(
  settings: ProcurementApprovalSettings,
  totalNetAmount: number,
  userId: string,
  options: { isOwner: boolean }
): string | null {
  if (options.isOwner || poSelfApproveAllowed(settings, totalNetAmount, userId, options)) {
    return null;
  }

  if (!settings.allow_submitter_self_approve_below_threshold) {
    return "You cannot approve your own submission. Another approver must approve this order.";
  }

  const threshold = settings.po_approval_threshold_amount;
  if (threshold == null || !Number.isFinite(threshold)) {
    return "You cannot approve your own submission without an approval threshold configured.";
  }

  if (Number.isFinite(totalNetAmount) && totalNetAmount > threshold) {
    return "You cannot approve your own submission when the PO exceeds the approval threshold. Another approver or a workspace owner must approve it.";
  }

  return "You cannot approve your own submission.";
}

export function isPurchaseOrderApprovableByUser(
  order: {
    document_status: string;
    total_net_amount: string | number;
    approval_submitted_by?: string | null;
  },
  userId: string,
  settings: ProcurementApprovalSettings,
  options: { isOwner: boolean }
): boolean {
  if (order.document_status !== "PENDING_APPROVAL") return false;

  // Workspace owners are super-approvers: any pending PO, any amount, including own submissions.
  if (options.isOwner) return true;

  const amount = Number(order.total_net_amount);
  if (!canUserApprovePurchaseOrderAmount(userId, settings, amount, options)) return false;

  const submitterId = order.approval_submitted_by ?? null;
  if (submitterId === userId) {
    return poSelfApproveAllowed(settings, amount, userId, options);
  }

  return true;
}

export function isPoApprovalRequiredBeforeIssue(
  settings: ProcurementApprovalSettings,
  totalNetAmount: number,
  userId: string,
  options: { isOwner: boolean },
  rulesRequireApproval?: boolean
): boolean {
  return isDocumentApprovalRequired({
    requireEnabled: settings.require_po_approval_before_issue,
    totalNetAmount,
    userId,
    isOwner: options.isOwner,
    allowSubmitterSelfApprove: settings.allow_submitter_self_approve_below_threshold,
    thresholdAmount: settings.po_approval_threshold_amount,
    approverUserIds: settings.po_approver_user_ids,
    approverRoles: settings.po_approver_roles,
    bands: settings.po_approval_bands,
    approverPools: settings.po_approver_pools,
    rulesRequireApproval,
  });
}
