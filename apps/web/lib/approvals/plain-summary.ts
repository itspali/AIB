import type { ApprovalPolicyBand } from "@/lib/approvals/policy-types";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";
import { describePoApprovalRule } from "@/lib/approvals/approval-rules";
import type { PoApprovalRule } from "@/lib/approvals/approval-rules";
import type { WorkflowChoice } from "@/lib/approvals/workflow-templates";

export type ApprovalScopeMode = "all" | "small_orders_exempt";

export function resolveApprovalScopeModeFromBands(
  thresholdAmount: number | null,
  bands?: ApprovalPolicyBand[]
): ApprovalScopeMode {
  const hasSkipBand = bands?.some((band) => band.skip);
  if (hasSkipBand || thresholdAmount != null) {
    return "small_orders_exempt";
  }
  return "all";
}

export function resolveApprovalScopeMode(
  settings: ProcurementApprovalSettings
): ApprovalScopeMode {
  return resolveApprovalScopeModeFromBands(
    settings.po_approval_threshold_amount,
    settings.po_approval_bands
  );
}

export function countExtraApprovalSteps(bands: ApprovalPolicyBand[]): number {
  const band = bands[0];
  if (!band?.levels?.length) return 1;
  return band.levels.length;
}

type ApprovalPlainSummaryWording = {
  draftNoun?: string;
  finalAction?: string;
  submitterNoun?: string;
};

type PlainSummaryRule = {
  type: string;
  enabled: boolean;
  threshold?: number | null;
  tolerance_percent?: number | null;
};

export function buildApprovalPlainSummary(options: {
  enabled: boolean;
  scopeMode: ApprovalScopeMode;
  thresholdAmount: number | null;
  allowSelfApproveSmall: boolean;
  approverCount: number;
  extraStepCount: number;
  enabledRules?: PlainSummaryRule[] | PoApprovalRule[];
  describeRule?: (rule: PlainSummaryRule) => string;
  workflowChoice?: WorkflowChoice;
  respectDestinationLocation?: boolean;
  reminderHours?: number | null;
  escalationHours?: number | null;
  wording?: ApprovalPlainSummaryWording;
  disabledSummary?: string;
}): string[] {
  const draftNoun = options.wording?.draftNoun ?? "purchase order";
  const finalAction = options.wording?.finalAction ?? "issued to the supplier";
  const submitterNoun = options.wording?.submitterNoun ?? "buyer";

  if (!options.enabled) {
    return [
      options.disabledSummary ??
        `Draft purchase orders can be issued to suppliers immediately.`,
      "No approval step is required.",
    ];
  }

  const lines: string[] = [
    `Someone creates a draft ${draftNoun} and submits it for approval.`,
  ];

  if (options.extraStepCount <= 1) {
    lines.push(
      options.approverCount > 0
        ? "One of your listed approvers (or a workspace owner) approves it."
        : "A workspace owner approves it."
    );
  } else if (options.workflowChoice === "manager_chain_finance") {
    lines.push(`Step 1: the ${submitterNoun}'s reporting manager approves.`);
    lines.push("Step 2: skip-level manager and finance approve in parallel.");
  } else {
    lines.push(`${options.extraStepCount} approval steps must be completed, in order.`);
  }

  lines.push(`The ${draftNoun} is then ${finalAction}.`);

  if (options.scopeMode === "small_orders_exempt" && options.thresholdAmount != null) {
    lines.push(
      `Documents under ${formatAmount(options.thresholdAmount)} do not need approval unless a rule below applies.`
    );
    if (options.allowSelfApproveSmall && options.approverCount > 0) {
      lines.push(
        `${submitterNoun.charAt(0).toUpperCase()}${submitterNoun.slice(1)}s who are approvers may approve their own documents under ${formatAmount(options.thresholdAmount)}.`
      );
    }
  }

  const rulesHaveEnabled =
    options.enabledRules?.some((rule) => rule.enabled) ??
    false;

  if (options.enabledRules && rulesHaveEnabled) {
    const describe =
      options.describeRule ??
      ((rule) => describePoApprovalRule(rule as PoApprovalRule));

    for (const rule of options.enabledRules) {
      const description = describe(rule);
      if (description) lines.push(description);
    }
  }

  if (options.respectDestinationLocation !== false) {
    lines.push(
      "Only approvers who can access the PO destination location are assigned (owners and admins stay global)."
    );
  }

  if (options.reminderHours != null && options.reminderHours > 0) {
    lines.push(
      `Approvers receive in-app reminders every ${options.reminderHours} hour(s) while a step is waiting.`
    );
  }

  if (options.escalationHours != null && options.escalationHours > 0) {
    lines.push(
      `Workspace owners are notified after ${options.escalationHours} hour(s) if a step is still pending.`
    );
  }

  return lines;
}

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function hasCustomWorkflow(settings: ProcurementApprovalSettings): boolean {
  const bands = settings.po_approval_bands;
  if (!bands?.length) return false;
  if (bands.length > 2) return true;

  return bands.some((band) => {
    if (band.skip) return false;
    const levels = band.levels ?? [];
    if (levels.length > 1) return true;
    const steps = levels[0]?.steps ?? [];
    return steps.length > 1 || steps.some((step) => step.quorum === "ALL");
  });
}

export function workflowBandsFromThreshold(
  thresholdAmount: number | null,
  bands?: ApprovalPolicyBand[]
): ApprovalPolicyBand[] {
  if (bands?.length) {
    return bands.filter((band) => !band.skip);
  }

  return [
    {
      min_amount: thresholdAmount ?? 0,
      max_amount: null,
      levels: [{ steps: [{ label: "Approvers", quorum: "ANY", pool: "default" }] }],
    },
  ];
}

export function workflowBandsFromSettings(
  settings: ProcurementApprovalSettings
): ApprovalPolicyBand[] {
  return workflowBandsFromThreshold(
    settings.po_approval_threshold_amount,
    settings.po_approval_bands
  );
}
