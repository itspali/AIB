import type { SupabaseClient } from "@supabase/supabase-js";
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
      "id, name, trade_name, legal_name, legal_registration_number, tax_identifier, onboarding_status, metadata_json"
    )
    .eq("id", tenantId)
    .single();

  if (tenantError || !tenant) return null;

  const { count: locationCount, data: locations, error: locationError } = await supabase
    .from("tenant_locations")
    .select("id, name, tax_registered_name, location_tax_identifier, state, city", { count: "exact" })
    .eq("tenant_id", tenantId)
    .limit(1);

  const accountResult = await safeCount(supabase, "accounts", tenantId);
  const taxResult = await safeCount(supabase, "tax_rate_registry", tenantId);
  const channelResult = await safeCount(supabase, "storefront_channels", tenantId);

  let returnPolicies: { id: string; policy_name: string }[] = [];
  let policiesMissing = false;
  let policiesRlsDenied = false;
  const { data: policies, error: policiesError } = await supabase
    .from("return_policies")
    .select("id, policy_name")
    .eq("tenant_id", tenantId);

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
  const step2Complete = accountResult.count >= 1;
  const step3Complete = taxResult.count >= 1;
  const step4Complete = channelResult.count >= 1;

  const steps: OnboardingStepState[] = [
    {
      id: "locations",
      title: "Corporate Profile & Location Network",
      status: stepStatus(step1Complete),
      completed: step1Complete,
    },
    {
      id: "coa",
      title: "Unified Chart of Accounts Initialization",
      status: stepStatus(step2Complete),
      completed: step2Complete,
    },
    {
      id: "tax",
      title: "Statutory Tax & Policy Slabs Registry",
      status: stepStatus(step3Complete, !step2Complete),
      completed: step3Complete,
    },
    {
      id: "channels",
      title: "Omnichannel Commercial Channels & Policies",
      status: stepStatus(step4Complete, !step3Complete),
      completed: step4Complete,
    },
  ];

  const completedSteps = steps.filter((s) => s.completed).length;
  const isOnboardingComplete = tenant.onboarding_status === "GO_LIVE_READY";

  return {
    tenant: tenant as TenantProfile,
    primaryLocation: (locations?.[0] as PrimaryLocation | undefined) ?? null,
    accountCount: accountResult.count,
    taxRateCount: taxResult.count,
    channelCount: channelResult.count,
    returnPolicies,
    steps,
    progressPercent: Math.round((completedSteps / 4) * 100),
    canLaunch: step1Complete && step2Complete && step3Complete && step4Complete,
    isOnboardingComplete,
    schemaWarning,
    rlsWarning,
  };
}

export function getFirstIncompleteStepId(steps: OnboardingStepState[]): WizardStepId {
  const order: WizardStepId[] = ["locations", "coa", "tax", "channels"];
  for (const id of order) {
    const step = steps.find((s) => s.id === id);
    if (step && !step.completed && step.status !== "LOCKED") {
      return id;
    }
  }
  return "channels";
}

export async function getTenantIdFromSession(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return (user.app_metadata?.tenant_id as string) ?? null;
}
