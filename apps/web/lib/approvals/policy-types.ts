export type ApprovalQuorum = "ANY" | "ALL";

export type ApprovalAssigneeMode =
  | "POOL"
  | "SUBMITTER_MANAGER"
  | "SUBMITTER_SKIP_MANAGER";

export type ApprovalPolicyStep = {
  label: string;
  quorum: ApprovalQuorum;
  pool: string;
  assignee?: ApprovalAssigneeMode;
};

export type ApprovalPolicyLevel = {
  steps: ApprovalPolicyStep[];
};

export type ApprovalPolicyBand = {
  min_amount: number;
  max_amount: number | null;
  skip?: boolean;
  self_approve?: boolean;
  levels?: ApprovalPolicyLevel[];
};

export type ApprovalApproverPool = {
  user_ids: string[];
  roles?: Array<"ADMIN" | "MANAGER">;
};

export type PoApprovalPolicyConfig = {
  bands: ApprovalPolicyBand[];
  pools: Record<string, ApprovalApproverPool>;
};
