import type { PipelineStage, SignupIssueBucket, TenantOnboardingStatus } from "./types";

export type PipelineInput = {
  authUserId: string | null;
  emailConfirmed: boolean;
  hasPublicUser: boolean;
  tenantId: string | null;
  tenantActive: boolean | null;
  tenantStatus: string | null;
  onboardingStatus: TenantOnboardingStatus | string | null;
  hasLocations: boolean;
  subscriptionStatus: string | null;
  isTrialPlan: boolean;
};

export function computeSignupIssueBucket(input: {
  authUserId: string | null;
  hasPublicUser: boolean;
  tenantId: string | null;
  hasLocations: boolean;
  signupPending: boolean;
  provisionDeferred: boolean;
  tenantIdInMetadata: boolean;
}): SignupIssueBucket {
  if (
    input.authUserId &&
    !input.hasPublicUser &&
    (input.signupPending || input.provisionDeferred)
  ) {
    return "A";
  }
  if (input.tenantId && !input.hasLocations) return "B";
  if (input.tenantIdInMetadata && !input.hasPublicUser) return "C";
  return null;
}

export function computePipelineStage(input: PipelineInput): PipelineStage {
  const inactive =
    input.tenantActive === false ||
    input.tenantStatus === "SUSPENDED" ||
    input.tenantStatus === "PAST_DUE" ||
    input.subscriptionStatus === "CANCELED" ||
    input.subscriptionStatus === "EXPIRED";

  if (input.tenantId && inactive) return "CHURNED";

  if (
    input.subscriptionStatus === "ACTIVE" &&
    !input.isTrialPlan &&
    input.tenantStatus === "ACTIVE"
  ) {
    return "PAYING";
  }

  if (input.tenantStatus === "TRIAL" || input.subscriptionStatus === "TRIALING") {
    return "TRIAL";
  }

  if (input.onboardingStatus === "GO_LIVE_READY") return "LIVE";

  if (input.tenantId) return "ONBOARDING";

  if (input.hasPublicUser || input.tenantId) return "TENANT_CREATED";

  if (input.authUserId && input.emailConfirmed) return "EMAIL_VERIFIED";

  if (input.authUserId) return "REGISTERED";

  return "REGISTERED";
}

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  REGISTERED: "Registered",
  EMAIL_VERIFIED: "Email verified",
  TENANT_CREATED: "Provisioned",
  ONBOARDING: "Onboarding",
  LIVE: "Live",
  TRIAL: "Trial",
  PAYING: "Paying",
  CHURNED: "Churned",
};
