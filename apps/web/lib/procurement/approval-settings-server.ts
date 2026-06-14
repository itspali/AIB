import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";
import type { ApprovalPolicyBand, ApprovalApproverPool } from "@/lib/approvals/policy-types";
import {
  normalizePoApprovalRules,
  normalizePoApproverRoles,
} from "@/lib/approvals/approval-rules";
import {
  detectPoWorkflowTemplate,
  extractFinanceApproverUserIds,
  type PoWorkflowTemplate,
} from "@/lib/approvals/workflow-templates";

const DEFAULT_APPROVAL_SETTINGS: ProcurementApprovalSettings = {
  require_po_approval_before_issue: false,
  po_approval_threshold_amount: null,
  allow_submitter_self_approve_below_threshold: false,
  po_approver_user_ids: [],
  po_approver_roles: [],
  po_approval_rules: normalizePoApprovalRules(undefined),
  po_workflow_template: "standard",
  po_finance_approver_user_ids: [],
  po_approval_bands: undefined,
  po_approver_pools: undefined,
  po_approval_respect_destination_location: true,
  po_approval_reminder_hours: 24,
  po_approval_escalation_hours: 72,
};

function parseOptionalHours(raw: unknown, fallback: number | null): number | null {
  if (raw === null || raw === undefined || raw === "") return fallback;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

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

  const bands = parseApprovalBands(meta.po_approval_bands);
  const pools = parseApproverPools(meta.po_approver_pools);
  const storedTemplate = meta.po_workflow_template;
  const workflowTemplate: PoWorkflowTemplate =
    storedTemplate === "manager_chain_finance" ||
    storedTemplate === "custom" ||
    storedTemplate === "standard"
      ? storedTemplate
      : detectPoWorkflowTemplate(bands);

  const financeIds = Array.isArray(meta.po_finance_approver_user_ids)
    ? meta.po_finance_approver_user_ids.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      )
    : extractFinanceApproverUserIds(pools);

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
    po_workflow_template: workflowTemplate,
    po_finance_approver_user_ids: financeIds,
    po_approval_bands: bands,
    po_approver_pools: pools,
    po_approval_respect_destination_location:
      typeof meta.po_approval_respect_destination_location === "boolean"
        ? meta.po_approval_respect_destination_location
        : DEFAULT_APPROVAL_SETTINGS.po_approval_respect_destination_location,
    po_approval_reminder_hours: parseOptionalHours(
      meta.po_approval_reminder_hours,
      DEFAULT_APPROVAL_SETTINGS.po_approval_reminder_hours ?? 24
    ),
    po_approval_escalation_hours: parseOptionalHours(
      meta.po_approval_escalation_hours,
      DEFAULT_APPROVAL_SETTINGS.po_approval_escalation_hours ?? 72
    ),
  };
}
