import type { SupabaseClient } from "@supabase/supabase-js";
import { readSessionClaims } from "@/lib/supabase/session-claims";
import {
  NEUTRAL_FINANCE_SETUP_COPY,
  NEUTRAL_PROFILE_COPY,
  resolveBusinessModelFromMetadata,
} from "@/lib/onboarding/business-model";
import type {
  MilestoneStatus,
  OnboardingSnapshot,
  OnboardingStepState,
  PrimaryLocation,
  TenantProfile,
  WizardStepId,
} from "./types";

function stepStatus(completed: boolean, locked = false): MilestoneStatus {
  if (locked) return "LOCKED";
  return completed ? "COMPLETED" : "ACTION_REQUIRED";
}

function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    message.includes("could not find the table") ||
    message.includes("schema cache") ||
    (message.includes("relation") && message.includes("does not exist"))
  );
}

function isRlsError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42501" ||
    message.includes("permission denied") ||
    message.includes("row-level security")
  );
}

async function safeCount(
  supabase: SupabaseClient,
  table: string,
  tenantId: string
): Promise<{ count: number; missing: boolean; rlsDenied: boolean }> {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);

  if (isMissingTableError(error)) {
    return { count: 0, missing: true, rlsDenied: false };
  }

  if (isRlsError(error)) {
    return { count: 0, missing: false, rlsDenied: true };
  }

  return { count: count ?? 0, missing: false, rlsDenied: false };
}

export async function fetchOnboardingSnapshot(
  supabase: SupabaseClient,
  tenantId: string
): Promise<OnboardingSnapshot | null> {
  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .select(
      "id, name, trade_name, legal_name, legal_registration_number, tax_identifier, country_code, onboarding_status, metadata_json"
    )
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant) return null;

  // Run the independent onboarding-step probes concurrently. At cloud latency
  // each await is a separate round-trip, so serializing them stacked up.
  const [
    { count: locationCount, data: locations, error: locationError },
    accountResult,
    taxResult,
    channelResult,
    { data: policies, error: policiesError },
  ] = await Promise.all([
    supabase
      .from("tenant_locations")
      .select(
        "id, name, code, address_line1, address_line2, tax_registered_name, location_tax_identifier, state, city, zip_postal, country_code",
        { count: "exact" }
      )
      .eq("tenant_id", tenantId)
      .limit(1),
    safeCount(supabase, "accounts", tenantId),
    safeCount(supabase, "tax_codes", tenantId),
    safeCount(supabase, "storefront_channels", tenantId),
    supabase.from("return_policies").select("id, policy_name").eq("tenant_id", tenantId),
  ]);

  let returnPolicies: { id: string; policy_name: string }[] = [];
  let policiesMissing = false;
  let policiesRlsDenied = false;

  if (isMissingTableError(policiesError)) {
    policiesMissing = true;
  } else if (isRlsError(policiesError)) {
    policiesRlsDenied = true;
  } else {
    returnPolicies = policies ?? [];
  }

  const schemaWarning =
    isMissingTableError(locationError) ||
    accountResult.missing ||
    taxResult.missing ||
    channelResult.missing ||
    policiesMissing;

  const rlsWarning =
    isRlsError(locationError) ||
    accountResult.rlsDenied ||
    taxResult.rlsDenied ||
    channelResult.rlsDenied ||
    policiesRlsDenied;

  const step1Complete = (locationCount ?? 0) >= 1;
  const financeComplete =
    accountResult.count >= 1 && taxResult.count >= 1 && channelResult.count >= 1;

  const metadata = (tenant.metadata_json as Record<string, unknown> | null) ?? {};
  const businessModel = resolveBusinessModelFromMetadata(metadata);

  const steps: OnboardingStepState[] = [
    {
      id: "profile",
      title: NEUTRAL_PROFILE_COPY.stepTitle,
      status: stepStatus(step1Complete),
      completed: step1Complete,
    },
    {
      id: "finance_setup",
      title: NEUTRAL_FINANCE_SETUP_COPY.stepTitle,
      status: stepStatus(financeComplete, !step1Complete),
      completed: financeComplete,
    },
  ];

  const completedSteps = steps.filter((s) => s.completed).length;
  const isOnboardingComplete = tenant.onboarding_status === "GO_LIVE_READY";

  return {
    tenant: tenant as TenantProfile,
    primaryLocation: (locations?.[0] as PrimaryLocation | undefined) ?? null,
    businessModel,
    accountCount: accountResult.count,
    taxRateCount: taxResult.count,
    channelCount: channelResult.count,
    returnPolicies,
    steps,
    progressPercent: Math.round((completedSteps / 2) * 100),
    canLaunch: step1Complete && financeComplete,
    isOnboardingComplete,
    schemaWarning,
    rlsWarning,
  };
}

export function hasWorkspaceAccess(snapshot: Pick<OnboardingSnapshot, "steps">): boolean {
  return snapshot.steps.find((step) => step.id === "profile")?.completed ?? false;
}

export function getFirstIncompleteStepId(steps: OnboardingStepState[]): WizardStepId {
  const order: WizardStepId[] = ["profile", "finance_setup"];
  for (const id of order) {
    const step = steps.find((s) => s.id === id);
    if (step && !step.completed && step.status !== "LOCKED") {
      return id;
    }
  }
  return "finance_setup";
}

export async function getTenantIdFromSession(supabase: SupabaseClient): Promise<string | null> {
  const claims = await readSessionClaims(supabase);
  return claims?.tenantId ?? null;
}
