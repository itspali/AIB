import { isDocumentApprovalRequired } from "@/lib/approvals/approval-required-gate";
import type { ApprovalPolicyBand, ApprovalApproverPool } from "@/lib/approvals/policy-types";
import type { PoApproverRole } from "@/lib/approvals/approval-rules";
import type { PoWorkflowTemplate } from "@/lib/approvals/workflow-templates";
import type { SalesApprovalRuleEvaluationLine } from "@/lib/sales/evaluate-sales-approval-rules";
import { salesApprovalRulesRequireApproval } from "@/lib/sales/evaluate-sales-approval-rules";
import type { SalesApprovalRule } from "@/lib/sales/sales-approval-rules";

export type SalesApprovalSettings = {
  require_so_approval_before_confirm: boolean;
  so_approval_threshold_amount: number | null;
  allow_submitter_self_approve_below_threshold: boolean;
  so_approver_user_ids: string[];
  so_approver_roles?: PoApproverRole[];
  so_approval_rules?: SalesApprovalRule[];
  so_workflow_template?: PoWorkflowTemplate;
  so_finance_approver_user_ids?: string[];
  so_approval_bands?: ApprovalPolicyBand[];
  so_approver_pools?: Record<string, ApprovalApproverPool>;
  require_quote_approval_before_confirm: boolean;
  quote_approval_threshold_amount: number | null;
  quote_approver_user_ids: string[];
  quote_approver_roles?: PoApproverRole[];
  quote_approval_rules?: SalesApprovalRule[];
  quote_workflow_template?: PoWorkflowTemplate;
  quote_finance_approver_user_ids?: string[];
  quote_approval_bands?: ApprovalPolicyBand[];
  quote_approver_pools?: Record<string, ApprovalApproverPool>;
  require_invoice_approval_before_post: boolean;
  invoice_approval_threshold_amount: number | null;
  invoice_approver_user_ids: string[];
  invoice_approver_roles?: PoApproverRole[];
  invoice_approval_rules?: SalesApprovalRule[];
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

export function quoteSelfApproveAllowed(
  settings: SalesApprovalSettings,
  totalNetAmount: number,
  userId: string,
  options: SalesApproverOptions
): boolean {
  return selfApproveAllowedByConfig(
    settings.allow_submitter_self_approve_below_threshold,
    settings.quote_approval_threshold_amount,
    totalNetAmount,
    userId,
    settings.quote_approver_user_ids,
    settings.quote_approver_roles,
    options
  );
}

export function invoiceSelfApproveAllowed(
  settings: SalesApprovalSettings,
  totalNetAmount: number,
  userId: string,
  options: SalesApproverOptions
): boolean {
  return selfApproveAllowedByConfig(
    settings.allow_submitter_self_approve_below_threshold,
    settings.invoice_approval_threshold_amount,
    totalNetAmount,
    userId,
    settings.invoice_approver_user_ids,
    settings.invoice_approver_roles,
    options
  );
}

function salesDocumentApprovalRequired(
  settings: SalesApprovalSettings,
  config: {
    requireEnabled: boolean;
    thresholdAmount: number | null;
    approverUserIds: string[];
    approverRoles?: PoApproverRole[];
    bands?: ApprovalPolicyBand[];
    approverPools?: Record<string, ApprovalApproverPool>;
    rules?: SalesApprovalRule[];
  },
  totalNetAmount: number,
  userId: string,
  options: SalesApproverOptions,
  lines?: SalesApprovalRuleEvaluationLine[]
): boolean {
  return isDocumentApprovalRequired({
    requireEnabled: config.requireEnabled,
    totalNetAmount,
    userId,
    isOwner: options.isOwner,
    allowSubmitterSelfApprove: settings.allow_submitter_self_approve_below_threshold,
    thresholdAmount: config.thresholdAmount,
    approverUserIds: config.approverUserIds,
    approverRoles: config.approverRoles,
    bands: config.bands,
    approverPools: config.approverPools,
    rulesRequireApproval: salesApprovalRulesRequireApproval(config.rules, lines),
  });
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
    return quoteSelfApproveAllowed(settings, amount, userId, options);
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
    return invoiceSelfApproveAllowed(settings, amount, userId, options);
  }

  return true;
}

export function isSoApprovalRequiredBeforeConfirm(
  settings: SalesApprovalSettings,
  totalNetAmount: number,
  userId: string,
  options: SalesApproverOptions,
  lines?: SalesApprovalRuleEvaluationLine[]
): boolean {
  return salesDocumentApprovalRequired(
    settings,
    {
      requireEnabled: settings.require_so_approval_before_confirm,
      thresholdAmount: settings.so_approval_threshold_amount,
      approverUserIds: settings.so_approver_user_ids,
      approverRoles: settings.so_approver_roles,
      bands: settings.so_approval_bands,
      approverPools: settings.so_approver_pools,
      rules: settings.so_approval_rules,
    },
    totalNetAmount,
    userId,
    options,
    lines
  );
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
  options: SalesApproverOptions,
  lines?: SalesApprovalRuleEvaluationLine[]
): boolean {
  return salesDocumentApprovalRequired(
    settings,
    {
      requireEnabled: settings.require_quote_approval_before_confirm,
      thresholdAmount: settings.quote_approval_threshold_amount,
      approverUserIds: settings.quote_approver_user_ids,
      approverRoles: settings.quote_approver_roles,
      bands: settings.quote_approval_bands,
      approverPools: settings.quote_approver_pools,
      rules: settings.quote_approval_rules,
    },
    totalNetAmount,
    userId,
    options,
    lines
  );
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
  options: SalesApproverOptions,
  lines?: SalesApprovalRuleEvaluationLine[]
): boolean {
  return salesDocumentApprovalRequired(
    settings,
    {
      requireEnabled: settings.require_invoice_approval_before_post,
      thresholdAmount: settings.invoice_approval_threshold_amount,
      approverUserIds: settings.invoice_approver_user_ids,
      approverRoles: settings.invoice_approver_roles,
      bands: settings.invoice_approval_bands,
      approverPools: settings.invoice_approver_pools,
      rules: settings.invoice_approval_rules,
    },
    totalNetAmount,
    userId,
    options,
    lines
  );
}

export function isSalesOrderConfirmableByUser(
  order: {
    commercial_status: string;
    total_net_amount: string | number;
    line_count: number;
    approval_workflow_complete?: boolean;
  },
  settings: SalesApprovalSettings,
  userId: string,
  options: SalesApproverOptions & { editAccessGranted: boolean }
): boolean {
  if (!options.editAccessGranted) return false;
  if (order.line_count < 1) return false;

  if (order.commercial_status === "DRAFT") {
    return !isSoApprovalRequiredBeforeConfirm(
      settings,
      Number(order.total_net_amount),
      userId,
      options
    );
  }

  if (order.commercial_status === "PENDING_APPROVAL") {
    return order.approval_workflow_complete === true;
  }

  return false;
}

export function isSalesInvoicePostableByUser(
  invoice: {
    commercial_status: string;
    total_net_amount: string | number;
    line_count: number;
    approval_workflow_complete?: boolean;
  },
  settings: SalesApprovalSettings,
  userId: string,
  options: SalesApproverOptions & { editAccessGranted: boolean }
): boolean {
  if (!options.editAccessGranted) return false;
  if (invoice.line_count < 1) return false;

  if (invoice.commercial_status === "DRAFT") {
    return !isInvoiceApprovalRequiredBeforePost(
      settings,
      Number(invoice.total_net_amount),
      userId,
      options
    );
  }

  if (invoice.commercial_status === "PENDING_APPROVAL") {
    return invoice.approval_workflow_complete === true;
  }

  return false;
}
