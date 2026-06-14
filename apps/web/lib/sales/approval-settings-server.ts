import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { SalesApprovalSettings } from "@/lib/sales/approval-settings";
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

const DEFAULT_SALES_APPROVAL_SETTINGS: SalesApprovalSettings = {
  require_so_approval_before_confirm: false,
  so_approval_threshold_amount: null,
  allow_submitter_self_approve_below_threshold: false,
  so_approver_user_ids: [],
  so_approver_roles: [],
  so_approval_rules: normalizePoApprovalRules(undefined),
  so_workflow_template: "standard",
  so_finance_approver_user_ids: [],
  so_approval_bands: undefined,
  so_approver_pools: undefined,
  require_quote_approval_before_confirm: false,
  quote_approval_threshold_amount: null,
  quote_approver_user_ids: [],
  quote_approver_roles: [],
  quote_approval_rules: normalizePoApprovalRules(undefined),
  quote_workflow_template: "standard",
  quote_finance_approver_user_ids: [],
  quote_approval_bands: undefined,
  quote_approver_pools: undefined,
  require_invoice_approval_before_post: false,
  invoice_approval_threshold_amount: null,
  invoice_approver_user_ids: [],
  invoice_approver_roles: [],
  invoice_approval_rules: normalizePoApprovalRules(undefined),
  invoice_workflow_template: "standard",
  invoice_finance_approver_user_ids: [],
  invoice_approval_bands: undefined,
  invoice_approver_pools: undefined,
};

function parseApprovalBands(raw: unknown): ApprovalPolicyBand[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw as ApprovalPolicyBand[];
}

function parseApproverPools(raw: unknown): Record<string, ApprovalApproverPool> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  return raw as Record<string, ApprovalApproverPool>;
}

function parseThreshold(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseApproverUserIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

function parseWorkflowTemplate(
  storedTemplate: unknown,
  bands: ApprovalPolicyBand[] | undefined
): PoWorkflowTemplate {
  if (
    storedTemplate === "manager_chain_finance" ||
    storedTemplate === "custom" ||
    storedTemplate === "standard"
  ) {
    return storedTemplate;
  }
  return detectPoWorkflowTemplate(bands);
}

function parseDocumentApprovalConfig(
  meta: Record<string, unknown>,
  prefix: "so" | "quote" | "invoice",
  requireKey: "require_so_approval_before_confirm" | "require_quote_approval_before_confirm" | "require_invoice_approval_before_post"
): Pick<
  SalesApprovalSettings,
  | `${typeof prefix}_approval_threshold_amount`
  | `${typeof prefix}_approver_user_ids`
  | `${typeof prefix}_approver_roles`
  | `${typeof prefix}_approval_rules`
  | `${typeof prefix}_workflow_template`
  | `${typeof prefix}_finance_approver_user_ids`
  | `${typeof prefix}_approval_bands`
  | `${typeof prefix}_approver_pools`
  | typeof requireKey
> {
  const bands = parseApprovalBands(meta[`${prefix}_approval_bands`]);
  const pools = parseApproverPools(meta[`${prefix}_approver_pools`]);
  const storedTemplate = meta[`${prefix}_workflow_template`];
  const workflowTemplate = parseWorkflowTemplate(storedTemplate, bands);

  const rawFinanceIds = meta[`${prefix}_finance_approver_user_ids`];
  const financeIds = Array.isArray(rawFinanceIds)
    ? rawFinanceIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0
      )
    : extractFinanceApproverUserIds(pools);

  const defaults = DEFAULT_SALES_APPROVAL_SETTINGS;

  return {
    [requireKey]:
      typeof meta[requireKey] === "boolean"
        ? meta[requireKey]
        : defaults[requireKey],
    [`${prefix}_approval_threshold_amount`]: parseThreshold(
      meta[`${prefix}_approval_threshold_amount`]
    ),
    [`${prefix}_approver_user_ids`]: parseApproverUserIds(meta[`${prefix}_approver_user_ids`]),
    [`${prefix}_approver_roles`]: normalizePoApproverRoles(meta[`${prefix}_approver_roles`]),
    [`${prefix}_approval_rules`]: normalizePoApprovalRules(meta[`${prefix}_approval_rules`]),
    [`${prefix}_workflow_template`]: workflowTemplate,
    [`${prefix}_finance_approver_user_ids`]: financeIds,
    [`${prefix}_approval_bands`]: bands,
    [`${prefix}_approver_pools`]: pools,
  } as Pick<
    SalesApprovalSettings,
    | `${typeof prefix}_approval_threshold_amount`
    | `${typeof prefix}_approver_user_ids`
    | `${typeof prefix}_approver_roles`
    | `${typeof prefix}_approval_rules`
    | `${typeof prefix}_workflow_template`
    | `${typeof prefix}_finance_approver_user_ids`
    | `${typeof prefix}_approval_bands`
    | `${typeof prefix}_approver_pools`
    | typeof requireKey
  >;
}

export async function fetchSalesApprovalSettings(
  supabase: SupabaseClient,
  tenantId: string
): Promise<SalesApprovalSettings> {
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

  return {
    ...parseDocumentApprovalConfig(meta, "so", "require_so_approval_before_confirm"),
    ...parseDocumentApprovalConfig(meta, "quote", "require_quote_approval_before_confirm"),
    ...parseDocumentApprovalConfig(meta, "invoice", "require_invoice_approval_before_post"),
    allow_submitter_self_approve_below_threshold:
      typeof meta.allow_submitter_self_approve_below_threshold === "boolean"
        ? meta.allow_submitter_self_approve_below_threshold
        : DEFAULT_SALES_APPROVAL_SETTINGS.allow_submitter_self_approve_below_threshold,
  };
}
