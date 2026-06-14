import type { ProcurementApprovalSettings } from "@/lib/procurement/approval-settings";
import type {
  ApprovalPolicyBand,
  ApprovalPolicyLevel,
  PoApprovalPolicyConfig,
} from "@/lib/approvals/policy-types";

export function synthesizePoPolicyFromLegacySettings(
  settings: ProcurementApprovalSettings
): PoApprovalPolicyConfig {
  if (settings.po_approval_bands?.length) {
    return {
      bands: settings.po_approval_bands,
      pools: settings.po_approver_pools ?? {
        default: { user_ids: settings.po_approver_user_ids },
      },
    };
  }

  const threshold = settings.po_approval_threshold_amount;
  const bands: ApprovalPolicyBand[] = [];

  const defaultLevel: ApprovalPolicyLevel = {
    steps: [
      {
        label: "Approvers",
        quorum: "ANY",
        pool: "default",
      },
    ],
  };

  if (threshold != null && Number.isFinite(threshold)) {
    bands.push({
      min_amount: 0,
      max_amount: threshold,
      skip: true,
      self_approve: settings.allow_submitter_self_approve_below_threshold,
    });
    bands.push({
      min_amount: threshold,
      max_amount: null,
      levels: [defaultLevel],
    });
  } else {
    bands.push({
      min_amount: 0,
      max_amount: null,
      levels: [defaultLevel],
    });
  }

  return {
    bands,
    pools: {
      default: { user_ids: settings.po_approver_user_ids },
    },
  };
}

export function describePolicyBand(band: ApprovalPolicyBand): string {
  const maxLabel =
    band.max_amount == null ? "∞" : band.max_amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
  const minLabel = band.min_amount.toLocaleString(undefined, { maximumFractionDigits: 2 });

  if (band.skip) {
    return `₹${minLabel} – ₹${maxLabel}: skip / self-approve`;
  }

  const levelCount = band.levels?.length ?? 0;
  const stepCount =
    band.levels?.reduce((sum, level) => sum + (level.steps?.length ?? 0), 0) ?? 0;

  return `₹${minLabel} – ₹${maxLabel}: ${levelCount} level(s), ${stepCount} step(s)`;
}
