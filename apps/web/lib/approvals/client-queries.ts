"use client";

import { createClient } from "@/lib/supabase/client";
import type { ApprovalRunStep, ApprovalStepAssignee, DocumentApprovalRun } from "@/lib/approvals/types";

function parseStepDecision(value: unknown): ApprovalStepAssignee["decision"] {
  if (value === "APPROVED" || value === "REJECTED") return value;
  return null;
}

function parseApprovalRun(payload: unknown): DocumentApprovalRun | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as Record<string, unknown>;
  if (typeof row.run_id !== "string") return null;

  const stepsRaw = row.steps;
  const steps = Array.isArray(stepsRaw)
    ? stepsRaw
        .filter((step): step is Record<string, unknown> => !!step && typeof step === "object")
        .map((step) => ({
          id: String(step.id),
          level_index: Number(step.level_index ?? 0),
          step_index: Number(step.step_index ?? 0),
          step_label: String(step.step_label ?? "Approval"),
          quorum_mode: (step.quorum_mode === "ALL" ? "ALL" : "ANY") as ApprovalRunStep["quorum_mode"],
          min_approvals: Number(step.min_approvals ?? 1),
          status: (String(step.status ?? "LOCKED") as ApprovalRunStep["status"]),
          opened_at: typeof step.opened_at === "string" ? step.opened_at : null,
          satisfied_at: typeof step.satisfied_at === "string" ? step.satisfied_at : null,
          assignees: Array.isArray(step.assignees)
            ? step.assignees
                .filter((a): a is Record<string, unknown> => !!a && typeof a === "object")
                .map((a) => ({
                  user_id: String(a.user_id),
                  is_required: Boolean(a.is_required),
                  decision: parseStepDecision(a.decision),
                }))
            : [],
        }))
    : [];

  return {
    run_id: row.run_id,
    status: String(row.status ?? "PENDING") as DocumentApprovalRun["status"],
    submitted_by: String(row.submitted_by ?? ""),
    submitted_at: String(row.submitted_at ?? ""),
    amount_basis: Number(row.amount_basis ?? 0),
    currency_code: String(row.currency_code ?? "USD"),
    completed_at: typeof row.completed_at === "string" ? row.completed_at : null,
    steps,
  };
}

export async function fetchDocumentApprovalRunClient(
  documentType: string,
  documentId: string
): Promise<DocumentApprovalRun | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("get_document_approval_run", {
    p_document_type: documentType,
    p_document_id: documentId,
  });

  if (error) return null;
  return parseApprovalRun(data);
}
