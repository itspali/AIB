import type { ApprovalPolicyBand, ApprovalApproverPool } from "@/lib/approvals/policy-types";
import type { PoApprovalRule, PoApproverRole } from "@/lib/approvals/approval-rules";
import type { PoWorkflowTemplate } from "@/lib/approvals/workflow-templates";

export type SalesApprovalSettings = {
  require_so_approval_before_confirm: boolean;
  so_approval_threshold_amount: number | null;
  allow_submitter_self_approve_below_threshold: boolean;
  so_approver_user_ids: string[];
  so_approver_roles?: PoApproverRole[];
  so_approval_rules?: PoApprovalRule[];
  so_workflow_template?: PoWorkflowTemplate;
  so_finance_approver_user_ids?: string[];
  so_approval_bands?: ApprovalPolicyBand[];
  so_approver_pools?: Record<string, ApprovalApproverPool>;
  require_quote_approval_before_confirm: boolean;
  quote_approval_threshold_amount: number | null;
  quote_approver_user_ids: string[];
  quote_approver_roles?: PoApproverRole[];
  quote_approval_rules?: PoApprovalRule[];
  quote_workflow_template?: PoWorkflowTemplate;
  quote_finance_approver_user_ids?: string[];
  quote_approval_bands?: ApprovalPolicyBand[];
  quote_approver_pools?: Record<string, ApprovalApproverPool>;
  require_invoice_approval_before_post: boolean;
  invoice_approval_threshold_amount: number | null;
  invoice_approver_user_ids: string[];
  invoice_approver_roles?: PoApproverRole[];
  invoice_approval_rules?: PoApprovalRule[];
  invoice_workflow_template?: PoWorkflowTemplate;
  invoice_finance_approver_user_ids?: string[];
  invoice_approval_bands?: ApprovalPolicyBand[];
  invoice_approver_pools?: Record<string, ApprovalApproverPool>;
};

type SalesApproverOptions = {
  isOwner: boolean;
  userRole?: PoApproverRole | "OWNER" | "STAFF" | null;
};

function canUserApproveByConfig(
  userId: string,
  approverUserIds: string[],
  approverRoles: PoApproverRole[] | undefined,
  options: SalesApproverOptions
): boolean {
  if (options.isOwner) return true;
  if (options.userRole && approverRoles?.includes(options.userRole as PoApproverRole)) {
    return true;
  }
  return approverUserIds.includes(userId);
}

function canUserApproveAmountByConfig(
  userId: string,
  approverUserIds: string[],
  approverRoles: PoApproverRole[] | undefined,
  thresholdAmount: number | null,
  totalNetAmount: number,
  options: SalesApproverOptions
): boolean {
  if (options.isOwner) return true;

  const isRoleApprover =
    options.userRole != null && approverRoles?.includes(options.userRole as PoApproverRole);

  if (!approverUserIds.includes(userId) && !isRoleApprover) return false;

  if (thresholdAmount == null || !Number.isFinite(thresholdAmount)) return true;

  return Number.isFinite(totalNetAmount) && totalNetAmount <= thresholdAmount;
}

function selfApproveAllowedByConfig(
  allowSubmitterSelfApprove: boolean,
  thresholdAmount: number | null,
  totalNetAmount: number,
  userId: string,
  approverUserIds: string[],
  approverRoles: PoApproverRole[] | undefined,
  options: SalesApproverOptions
): boolean {
  if (options.isOwner) return true;
  if (!allowSubmitterSelfApprove) return false;
  if (!canUserApproveByConfig(userId, approverUserIds, approverRoles, options)) return false;

  if (thresholdAmount == null || !Number.isFinite(thresholdAmount)) return false;

  return Number.isFinite(totalNetAmount) && totalNetAmount <= thresholdAmount;
}

export function canUserApproveSalesOrders(
  userId: string,
  settings: SalesApprovalSettings,
  options: SalesApproverOptions
): boolean {
  return canUserApproveByConfig(
    userId,
    settings.so_approver_user_ids,
    settings.so_approver_roles,
    options
  );
}

export function canUserApproveSalesOrderAmount(
  userId: string,
  settings: SalesApprovalSettings,
  totalNetAmount: number,
  options: SalesApproverOptions
): boolean {
  return canUserApproveAmountByConfig(
    userId,
    settings.so_approver_user_ids,
    settings.so_approver_roles,
    settings.so_approval_threshold_amount,
    totalNetAmount,
    options
  );
}

export function soSelfApproveAllowed(
  settings: SalesApprovalSettings,
  totalNetAmount: number,
  userId: string,
  options: SalesApproverOptions
): boolean {
  return selfApproveAllowedByConfig(
    settings.allow_submitter_self_approve_below_threshold,
    settings.so_approval_threshold_amount,
    totalNetAmount,
    userId,
    settings.so_approver_user_ids,
    settings.so_approver_roles,
    options
  );
}

export function describeSalesOrderSelfApprovalBlocker(
  settings: SalesApprovalSettings,
  totalNetAmount: number,
  userId: string,
  options: SalesApproverOptions
): string | null {
  if (options.isOwner || soSelfApproveAllowed(settings, totalNetAmount, userId, options)) {
    return null;
  }

  if (!settings.allow_submitter_self_approve_below_threshold) {
    return "You cannot approve your own submission. Another approver must approve this order.";
  }

  const threshold = settings.so_approval_threshold_amount;
  if (threshold == null || !Number.isFinite(threshold)) {
    return "You cannot approve your own submission without an approval threshold configured.";
  }

  if (Number.isFinite(totalNetAmount) && totalNetAmount > threshold) {
    return "You cannot approve your own submission when the sales order exceeds the approval threshold. Another approver or a workspace owner must approve it.";
  }

  return "You cannot approve your own submission.";
}

export function isSalesOrderApprovableByUser(
  order: {
    commercial_status: string;
    total_net_amount: string | number;
    approval_submitted_by?: string | null;
  },
  userId: string,
  settings: SalesApprovalSettings,
  options: SalesApproverOptions
): boolean {
  if (order.commercial_status !== "PENDING_APPROVAL") return false;
  if (options.isOwner) return true;

  const amount = Number(order.total_net_amount);
  if (!canUserApproveSalesOrderAmount(userId, settings, amount, options)) return false;

  const submitterId = order.approval_submitted_by ?? null;
  if (submitterId === userId) {
    return soSelfApproveAllowed(settings, amount, userId, options);
  }

  return true;
}

export function isSalesQuoteApprovableByUser(
  quote: {
    commercial_status: string;
    total_net_amount: string | number;
    approval_submitted_by?: string | null;
  },
  userId: string,
  settings: SalesApprovalSettings,
  options: SalesApproverOptions
): boolean {
  if (quote.commercial_status !== "PENDING_APPROVAL") return false;
  if (options.isOwner) return true;

  const amount = Number(quote.total_net_amount);
  if (!canUserApproveSalesQuoteAmount(userId, settings, amount, options)) return false;

  const submitterId = quote.approval_submitted_by ?? null;
  if (submitterId === userId) {
    return soSelfApproveAllowed(settings, amount, userId, options);
  }

  return true;
}

export function isSalesInvoiceApprovableByUser(
  invoice: {
    commercial_status: string;
    total_net_amount: string | number;
    approval_submitted_by?: string | null;
  },
  userId: string,
  settings: SalesApprovalSettings,
  options: SalesApproverOptions
): boolean {
  if (invoice.commercial_status !== "PENDING_APPROVAL") return false;
  if (options.isOwner) return true;

  const amount = Number(invoice.total_net_amount);
  if (!canUserApproveSalesInvoiceAmount(userId, settings, amount, options)) return false;

  const submitterId = invoice.approval_submitted_by ?? null;
  if (submitterId === userId) {
    return soSelfApproveAllowed(settings, amount, userId, options);
  }

  return true;
}

export function isSoApprovalRequiredBeforeConfirm(
  settings: SalesApprovalSettings,
  totalNetAmount: number,
  userId: string,
  options: SalesApproverOptions
): boolean {
  if (!settings.require_so_approval_before_confirm) return false;

  const threshold = settings.so_approval_threshold_amount;
  const isApprover = canUserApproveSalesOrders(userId, settings, options);

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

export function canUserApproveSalesQuotes(
  userId: string,
  settings: SalesApprovalSettings,
  options: SalesApproverOptions
): boolean {
  return canUserApproveByConfig(
    userId,
    settings.quote_approver_user_ids,
    settings.quote_approver_roles,
    options
  );
}

export function canUserApproveSalesQuoteAmount(
  userId: string,
  settings: SalesApprovalSettings,
  totalNetAmount: number,
  options: SalesApproverOptions
): boolean {
  return canUserApproveAmountByConfig(
    userId,
    settings.quote_approver_user_ids,
    settings.quote_approver_roles,
    settings.quote_approval_threshold_amount,
    totalNetAmount,
    options
  );
}

export function isQuoteApprovalRequiredBeforeConfirm(
  settings: SalesApprovalSettings,
  totalNetAmount: number,
  userId: string,
  options: SalesApproverOptions
): boolean {
  if (!settings.require_quote_approval_before_confirm) return false;

  const threshold = settings.quote_approval_threshold_amount;
  const isApprover = canUserApproveSalesQuotes(userId, settings, options);

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

export function canUserApproveSalesInvoices(
  userId: string,
  settings: SalesApprovalSettings,
  options: SalesApproverOptions
): boolean {
  return canUserApproveByConfig(
    userId,
    settings.invoice_approver_user_ids,
    settings.invoice_approver_roles,
    options
  );
}

export function canUserApproveSalesInvoiceAmount(
  userId: string,
  settings: SalesApprovalSettings,
  totalNetAmount: number,
  options: SalesApproverOptions
): boolean {
  return canUserApproveAmountByConfig(
    userId,
    settings.invoice_approver_user_ids,
    settings.invoice_approver_roles,
    settings.invoice_approval_threshold_amount,
    totalNetAmount,
    options
  );
}

export function isInvoiceApprovalRequiredBeforePost(
  settings: SalesApprovalSettings,
  totalNetAmount: number,
  userId: string,
  options: SalesApproverOptions
): boolean {
  if (!settings.require_invoice_approval_before_post) return false;

  const threshold = settings.invoice_approval_threshold_amount;
  const isApprover = canUserApproveSalesInvoices(userId, settings, options);

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
