import type { ApprovalPolicyBand } from "@/lib/approvals/policy-types";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";
import { describePoApprovalRule, hasEnabledPoApprovalRules } from "@/lib/approvals/approval-rules";
import type { PoApprovalRule } from "@/lib/approvals/approval-rules";

export type ApprovalScopeMode = "all" | "small_orders_exempt";

export function resolveApprovalScopeMode(
  settings: ProcurementApprovalSettings
): ApprovalScopeMode {
  const hasSkipBand = settings.po_approval_bands?.some((band) => band.skip);
  if (hasSkipBand || settings.po_approval_threshold_amount != null) {
    return "small_orders_exempt";
  }
  return "all";
}

export function countExtraApprovalSteps(bands: ApprovalPolicyBand[]): number {
  const band = bands[0];
  if (!band?.levels?.length) return 1;
  return band.levels.length;
}

export function buildApprovalPlainSummary(options: {
  enabled: boolean;
  scopeMode: ApprovalScopeMode;
  thresholdAmount: number | null;
  allowSelfApproveSmall: boolean;
  approverCount: number;
  extraStepCount: number;
  enabledRules?: PoApprovalRule[];
}): string[] {
  if (!options.enabled) {
    return [
      "Draft purchase orders can be issued to suppliers immediately.",
      "No approval step is required.",
    ];
  }

  const lines: string[] = [
    "Someone creates a draft purchase order and submits it for approval.",
  ];

  if (options.extraStepCount <= 1) {
    lines.push(
      options.approverCount > 0
        ? "One of your listed approvers (or a workspace owner) approves it."
        : "A workspace owner approves it."
    );
  } else {
    lines.push(`${options.extraStepCount} approval steps must be completed, in order.`);
  }

  lines.push("The purchase order is then issued to the supplier.");

  if (options.scopeMode === "small_orders_exempt" && options.thresholdAmount != null) {
    lines.push(
      `Orders under ${formatAmount(options.thresholdAmount)} do not need approval unless a rule below applies.`
    );
    if (options.allowSelfApproveSmall && options.approverCount > 0) {
      lines.push(
        `Buyers who are approvers may approve their own orders under ${formatAmount(options.thresholdAmount)}.`
      );
    }
  }

  if (options.enabledRules && hasEnabledPoApprovalRules(options.enabledRules)) {
    for (const rule of options.enabledRules) {
      const description = describePoApprovalRule(rule);
      if (description) lines.push(description);
    }
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

export function workflowBandsFromSettings(
  settings: ProcurementApprovalSettings
): ApprovalPolicyBand[] {
  if (settings.po_approval_bands?.length) {
    return settings.po_approval_bands.filter((band) => !band.skip);
  }

  return [
    {
      min_amount: settings.po_approval_threshold_amount ?? 0,
      max_amount: null,
      levels: [{ steps: [{ label: "Approvers", quorum: "ANY", pool: "default" }] }],
    },
  ];
}
