export type ApprovalRunStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type ApprovalStepStatus = "LOCKED" | "PENDING" | "SATISFIED" | "REJECTED" | "SKIPPED";

export type ApprovalQuorumMode = "ANY" | "ALL";

export type ApprovalStepAssignee = {
  user_id: string;
  is_required: boolean;
  decision: "APPROVED" | "REJECTED" | null;
};

export type ApprovalRunStep = {
  id: string;
  level_index: number;
  step_index: number;
  step_label: string;
  quorum_mode: ApprovalQuorumMode;
  min_approvals: number;
  status: ApprovalStepStatus;
  opened_at: string | null;
  satisfied_at: string | null;
  assignees: ApprovalStepAssignee[];
};

export type DocumentApprovalRun = {
  run_id: string;
  status: ApprovalRunStatus;
  submitted_by: string;
  submitted_at: string;
  amount_basis: number;
  currency_code: string;
  completed_at: string | null;
  steps: ApprovalRunStep[];
};

export type ApprovalTaskRow = {
  run_id: string;
  document_type: string;
  document_id: string;
  step_id: string;
  step_label: string;
  level_index: number;
  quorum_mode: ApprovalQuorumMode;
  amount_basis: number;
  currency_code: string;
  submitted_at: string;
  submitted_by: string;
  voucher_number: string | null;
  party_name: string | null;
};

export type UserNotificationRow = {
  id: string;
  event_code: string;
  title: string;
  body: string;
  action_url: string | null;
  document_type: string | null;
  document_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type UserNotificationFeed = {
  items: UserNotificationRow[];
  unread_count: number;
};
