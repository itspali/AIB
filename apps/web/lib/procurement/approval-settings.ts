export type ProcurementApprovalSettings = {
  require_po_approval_before_issue: boolean;
  po_approval_threshold_amount: number | null;
  allow_submitter_self_approve_below_threshold: boolean;
  po_approver_user_ids: string[];
};

export function canUserApprovePurchaseOrders(
  userId: string,
  settings: ProcurementApprovalSettings,
  options: { isOwner: boolean }
): boolean {
  if (options.isOwner) return true;
  return settings.po_approver_user_ids.includes(userId);
}

export function isPoApprovalRequiredBeforeIssue(
  settings: ProcurementApprovalSettings,
  totalNetAmount: number,
  userId: string,
  options: { isOwner: boolean }
): boolean {
  if (!settings.require_po_approval_before_issue) return false;

  const threshold = settings.po_approval_threshold_amount;
  const isApprover = canUserApprovePurchaseOrders(userId, settings, options);

  if (
    settings.allow_submitter_self_approve_below_threshold &&
    isApprover &&
    threshold != null &&
    Number.isFinite(totalNetAmount) &&
    totalNetAmount <= threshold
  ) {
    return false;
  }

  return true;
}
