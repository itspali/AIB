import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ApprovalRunStep,
  ApprovalStepAssignee,
  ApprovalTaskRow,
  DocumentApprovalRun,
  UserNotificationFeed,
} from "@/lib/approvals/types";

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

export async function fetchDocumentApprovalRun(
  supabase: SupabaseClient,
  documentType: string,
  documentId: string
): Promise<DocumentApprovalRun | null> {
  const { data, error } = await supabase.rpc("get_document_approval_run", {
    p_document_type: documentType,
    p_document_id: documentId,
  });

  if (error) return null;
  return parseApprovalRun(data);
}

export async function fetchMyApprovalTasks(
  supabase: SupabaseClient,
  limit = 50
): Promise<ApprovalTaskRow[]> {
  const { data, error } = await supabase.rpc("fetch_my_approval_tasks", {
    p_limit: limit,
  });

  if (error || !Array.isArray(data)) return [];

  return data
    .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
    .map((row) => ({
      run_id: String(row.run_id),
      document_type: String(row.document_type),
      document_id: String(row.document_id),
      step_id: String(row.step_id),
      step_label: String(row.step_label ?? "Approval"),
      level_index: Number(row.level_index ?? 0),
      quorum_mode: row.quorum_mode === "ALL" ? "ALL" : "ANY",
      amount_basis: Number(row.amount_basis ?? 0),
      currency_code: String(row.currency_code ?? "USD"),
      submitted_at: String(row.submitted_at ?? ""),
      submitted_by: String(row.submitted_by ?? ""),
      voucher_number: typeof row.voucher_number === "string" ? row.voucher_number : null,
      party_name: typeof row.party_name === "string" ? row.party_name : null,
    }));
}

export async function fetchUserNotificationFeed(
  supabase: SupabaseClient,
  options?: { limit?: number; unreadOnly?: boolean }
): Promise<UserNotificationFeed> {
  const { data, error } = await supabase.rpc("fetch_user_notifications", {
    p_limit: options?.limit ?? 20,
    p_unread_only: options?.unreadOnly ?? false,
  });

  if (error || !data || typeof data !== "object") {
    return { items: [], unread_count: 0 };
  }

  const payload = data as Record<string, unknown>;
  const unread = Number(payload.unread_count ?? 0);
  const itemsRaw = payload.items;

  const items = Array.isArray(itemsRaw)
    ? itemsRaw
        .filter((row): row is Record<string, unknown> => !!row && typeof row === "object")
        .map((row) => ({
          id: String(row.id),
          event_code: String(row.event_code ?? ""),
          title: String(row.title ?? ""),
          body: String(row.body ?? ""),
          action_url: typeof row.action_url === "string" ? row.action_url : null,
          document_type: typeof row.document_type === "string" ? row.document_type : null,
          document_id: typeof row.document_id === "string" ? row.document_id : null,
          is_read: Boolean(row.is_read),
          created_at: String(row.created_at ?? ""),
        }))
    : [];

  return { items, unread_count: Number.isFinite(unread) ? unread : 0 };
}

export { countApprovalLevels, resolveActiveApprovalStep } from "@/lib/approvals/utils";
