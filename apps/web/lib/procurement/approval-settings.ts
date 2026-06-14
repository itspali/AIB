import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type ProcurementApprovalSettings = {
  require_po_approval_before_issue: boolean;
  po_approval_threshold_amount: number | null;
  allow_submitter_self_approve_below_threshold: boolean;
  po_approver_user_ids: string[];
};

const DEFAULT_APPROVAL_SETTINGS: ProcurementApprovalSettings = {
  require_po_approval_before_issue: false,
  po_approval_threshold_amount: null,
  allow_submitter_self_approve_below_threshold: false,
  po_approver_user_ids: [],
};

export async function fetchProcurementApprovalSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProcurementApprovalSettings> {
  const { data: row } = await supabase
    .from("workspace_control_registry")
    .select("configuration_metadata")
    .eq("tenant_id", tenantId)
    .eq("registry_key", "APPROVAL_SETTINGS")
    .eq("scope_level", "TENANT_GLOBAL")
    .is("target_reference_id", null)
    .maybeSingle();

  const meta =
    row?.configuration_metadata && typeof row.configuration_metadata === "object"
      ? (row.configuration_metadata as Record<string, unknown>)
      : {};

  const threshold = meta.po_approval_threshold_amount;
  let poApprovalThreshold: number | null = null;
  if (typeof threshold === "number" && Number.isFinite(threshold)) {
    poApprovalThreshold = threshold;
  } else if (typeof threshold === "string" && threshold.trim()) {
    const parsed = Number(threshold);
    if (Number.isFinite(parsed)) poApprovalThreshold = parsed;
  }

  const approverIds = meta.po_approver_user_ids;
  const poApproverUserIds = Array.isArray(approverIds)
    ? approverIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
    : [];

  return {
    require_po_approval_before_issue:
      typeof meta.require_po_approval_before_issue === "boolean"
        ? meta.require_po_approval_before_issue
        : DEFAULT_APPROVAL_SETTINGS.require_po_approval_before_issue,
    po_approval_threshold_amount: poApprovalThreshold,
    allow_submitter_self_approve_below_threshold:
      typeof meta.allow_submitter_self_approve_below_threshold === "boolean"
        ? meta.allow_submitter_self_approve_below_threshold
        : DEFAULT_APPROVAL_SETTINGS.allow_submitter_self_approve_below_threshold,
    po_approver_user_ids: poApproverUserIds,
  };
}

export { DEFAULT_APPROVAL_SETTINGS };

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
