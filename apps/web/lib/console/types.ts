export type AppConsoleRole = "VIEWER" | "OPERATOR" | "ADMIN";

export type AppConsoleAction =
  | "TENANT_VIEW"
  | "TENANT_SUSPEND"
  | "TENANT_REACTIVATE"
  | "TENANT_STATUS_UPDATE"
  | "ONBOARDING_FORCE_STATUS"
  | "USER_DEACTIVATE"
  | "USER_REACTIVATE"
  | "AUTH_EMAIL_CONFIRM"
  | "AUTH_PASSWORD_RESET"
  | "SIGNUP_RETRY_PROVISION"
  | "IMPERSONATION_START"
  | "IMPERSONATION_END"
  | "GROUP_VIEW"
  | "GROUP_SUSPEND"
  | "PLATFORM_CONFIG_UPDATE"
  | "INTERNAL_ADMIN_GRANT"
  | "INTERNAL_ADMIN_REVOKE"
  | "MFA_ENROLL"
  | "MFA_VERIFY_SUCCESS"
  | "MFA_VERIFY_FAILED"
  | "PLAN_CREATE"
  | "PLAN_UPDATE"
  | "PLAN_ARCHIVE"
  | "SUBSCRIPTION_ASSIGN"
  | "SUBSCRIPTION_CHANGE_PLAN"
  | "TRIAL_EXTEND"
  | "TRIAL_CONVERT"
  | "TRIAL_END"
  | "SUBSCRIPTION_CANCEL"
  | "SUBSCRIPTION_MARK_PAST_DUE";

export type PipelineStage =
  | "REGISTERED"
  | "EMAIL_VERIFIED"
  | "TENANT_CREATED"
  | "ONBOARDING"
  | "LIVE"
  | "TRIAL"
  | "PAYING"
  | "CHURNED";

export type SignupIssueBucket = "A" | "B" | "C" | null;

export type ConsoleOperator = {
  id: string;
  user_id: string;
  email: string;
  role: AppConsoleRole;
  is_active: boolean;
  mfa_enforced: boolean;
  granted_at: string;
  notes: string | null;
};

export type TenantAccountStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED";

export type TenantOnboardingStatus =
  | "ACCOUNT_CREATED"
  | "ORGANIZATION_CONFIGURED"
  | "DATABASE_SEEDED"
  | "COMPLIANCE_VERIFIED"
  | "GO_LIVE_READY";

export type TenantOnboardingSource =
  | "DIRECT_SAAS"
  | "PARTNER_REFERRAL"
  | "SALES_OUTREACH"
  | "MARKETPLACE_INTEGRATION";

export type GroupAccountStatus = "TRIAL" | "ACTIVE" | "PAST_DUE" | "SUSPENDED";

export type SubscriptionPlanInterval = "MONTHLY" | "YEARLY";

export type TenantSubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "EXPIRED";
