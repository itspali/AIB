import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";
import type { ApprovalPolicyBand, ApprovalApproverPool } from "@/lib/approvals/policy-types";
import {
  normalizePoApprovalRules,
  normalizePoApproverRoles,
} from "@/lib/approvals/approval-rules";

const DEFAULT_APPROVAL_SETTINGS: ProcurementApprovalSettings = {
  require_po_approval_before_issue: false,
  po_approval_threshold_amount: null,
  allow_submitter_self_approve_below_threshold: false,
  po_approver_user_ids: [],
  po_approver_roles: [],
  po_approval_rules: normalizePoApprovalRules(undefined),
  po_approval_bands: undefined,
  po_approver_pools: undefined,
};

function parseApprovalBands(raw: unknown): ApprovalPolicyBand[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw as ApprovalPolicyBand[];
}

function parseApproverPools(raw: unknown): Record<string, ApprovalApproverPool> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return raw as Record<string, ApprovalApproverPool>;
}

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
    po_approver_roles: normalizePoApproverRoles(meta.po_approver_roles),
    po_approval_rules: normalizePoApprovalRules(meta.po_approval_rules),
    po_approval_bands: parseApprovalBands(meta.po_approval_bands),
    po_approver_pools: parseApproverPools(meta.po_approver_pools),
  };
}
