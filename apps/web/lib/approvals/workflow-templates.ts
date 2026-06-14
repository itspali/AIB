import type { ApprovalPolicyBand, ApprovalPolicyLevel } from "@/lib/approvals/policy-types";

export type PoWorkflowTemplate = "standard" | "manager_chain_finance" | "custom";

export function buildManagerChainFinanceLevels(): ApprovalPolicyLevel[] {
  return [
    {
      steps: [
        {
          label: "Reporting manager",
          quorum: "ANY",
          pool: "default",
          assignee: "SUBMITTER_MANAGER",
        },
      ],
    },
    {
      steps: [
        {
          label: "Skip-level manager",
          quorum: "ANY",
          pool: "default",
          assignee: "SUBMITTER_SKIP_MANAGER",
        },
        {
          label: "Finance",
          quorum: "ANY",
          pool: "finance",
          assignee: "POOL",
        },
      ],
    },
  ];
}

export function detectPoWorkflowTemplate(
  bands: ApprovalPolicyBand[] | undefined
): PoWorkflowTemplate {
  if (!bands?.length) return "standard";

  const workflowBand = bands.find((band) => !band.skip && band.levels?.length);
  if (!workflowBand?.levels) return "standard";

  const levels = workflowBand.levels;
  if (levels.length !== 2) return "custom";

  const first = levels[0]?.steps?.[0];
  const second = levels[1]?.steps ?? [];

  const isManagerChain =
    first?.assignee === "SUBMITTER_MANAGER" &&
    second.some((step) => step.assignee === "SUBMITTER_SKIP_MANAGER") &&
    second.some((step) => step.pool === "finance");

  return isManagerChain ? "manager_chain_finance" : "custom";
}

export function extractFinanceApproverUserIds(
  pools: Record<string, { user_ids?: string[] }> | undefined
): string[] {
  return pools?.finance?.user_ids ?? [];
}

export type WorkflowChoice = "simple" | "manager_chain_finance" | "custom";

export function resolveWorkflowChoice(settings: {
  po_workflow_template?: PoWorkflowTemplate;
  po_approval_bands?: ApprovalPolicyBand[];
}): WorkflowChoice {
  return resolveWorkflowChoiceFromBands(
    settings.po_workflow_template,
    settings.po_approval_bands
  );
}

export function resolveWorkflowChoiceFromBands(
  storedTemplate: PoWorkflowTemplate | undefined,
  bands: ApprovalPolicyBand[] | undefined
): WorkflowChoice {
  const template = storedTemplate ?? detectPoWorkflowTemplate(bands);
  if (template === "manager_chain_finance") return "manager_chain_finance";
  if (template === "custom") return "custom";
  return "simple";
}
