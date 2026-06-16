import type {
  ApprovalApproverPool,
  ApprovalPolicyBand,
  PoApprovalPolicyConfig,
} from "@/lib/approvals/policy-types";
import { synthesizePoPolicyFromLegacySettings } from "@/lib/approvals/normalize-policy";
import type { PoApproverRole } from "@/lib/approvals/approval-rules";
import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";

export type DocumentApprovalPolicyInput = {
  thresholdAmount: number | null;
  allowSubmitterSelfApprove: boolean;
  approverUserIds: string[];
  approverRoles?: PoApproverRole[];
  bands?: ApprovalPolicyBand[];
  approverPools?: Record<string, ApprovalApproverPool>;
};

/** Mirrors `private.resolve_po_approval_band`. */
export function resolveApprovalBand(
  amount: number,
  policy: Pick<PoApprovalPolicyConfig, "bands">
): ApprovalPolicyBand | null {
  const sorted = [...policy.bands].sort((left, right) => left.min_amount - right.min_amount);

  for (const band of sorted) {
    const minAmount = band.min_amount ?? 0;
    const maxAmount = band.max_amount;
    const normalizedAmount = Number.isFinite(amount) ? amount : 0;

    if (
      normalizedAmount >= minAmount &&
      (maxAmount == null || normalizedAmount <= maxAmount)
    ) {
      return band;
    }
  }

  return null;
}

export function resolveDocumentApprovalPolicy(
  input: DocumentApprovalPolicyInput
): PoApprovalPolicyConfig {
  if (input.bands?.length) {
    return {
      bands: input.bands,
      pools:
        input.approverPools ??
        ({
          default: {
            user_ids: input.approverUserIds,
            roles: input.approverRoles ?? [],
          },
        } satisfies Record<string, ApprovalApproverPool>),
    };
  }

  const legacySettings: ProcurementApprovalSettings = {
    require_po_approval_before_issue: true,
    po_approval_threshold_amount: input.thresholdAmount,
    allow_submitter_self_approve_below_threshold: input.allowSubmitterSelfApprove,
    po_approver_user_ids: input.approverUserIds,
    po_approver_roles: input.approverRoles,
    po_approval_bands: input.bands,
    po_approver_pools: input.approverPools,
  };

  return synthesizePoPolicyFromLegacySettings(legacySettings);
}

/** Mirrors `private.sales_self_approve_allowed` / `private.po_self_approve_allowed`. */
export function submitterSelfApproveAllowed(input: {
  totalNetAmount: number;
  userId: string;
  isOwner: boolean;
  allowSubmitterSelfApprove: boolean;
  thresholdAmount: number | null;
  approverUserIds: string[];
}): boolean {
  if (!input.userId) return false;
  if (input.isOwner) return true;
  if (!input.allowSubmitterSelfApprove) return false;
  if (!input.approverUserIds.includes(input.userId)) return false;

  if (input.thresholdAmount == null || !Number.isFinite(input.thresholdAmount)) {
    return false;
  }

  return Number.isFinite(input.totalNetAmount) && input.totalNetAmount <= input.thresholdAmount;
}

/** Mirrors document approval-required gates in Postgres (`*_approval_required`). */
export function isDocumentApprovalRequired(input: {
  requireEnabled: boolean;
  totalNetAmount: number;
  userId: string;
  isOwner: boolean;
  allowSubmitterSelfApprove: boolean;
  thresholdAmount: number | null;
  approverUserIds: string[];
  approverRoles?: PoApproverRole[];
  bands?: ApprovalPolicyBand[];
  approverPools?: Record<string, ApprovalApproverPool>;
  rulesRequireApproval?: boolean;
}): boolean {
  if (!input.requireEnabled) return false;
  if (input.rulesRequireApproval) return true;

  if (submitterSelfApproveAllowed(input)) return false;

  const policy = resolveDocumentApprovalPolicy(input);
  const band = resolveApprovalBand(input.totalNetAmount, policy);
  if (band?.skip) return false;

  return true;
}
