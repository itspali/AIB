import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MilestoneStatus,
  OnboardingSnapshot,
  OnboardingStepState,
  PrimaryLocation,
  TenantProfile,
} from "./types";

function stepStatus(completed: boolean, locked = false): MilestoneStatus {
  if (locked) return "LOCKED";
  return completed ? "COMPLETED" : "ACTION_REQUIRED";
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

  const [
    { count: locationCount, data: locations },
    { count: accountCount },
    { count: taxRateCount },
    { count: channelCount },
    { data: returnPolicies },
  ] = await Promise.all([
    supabase
      .from("tenant_locations")
      .select("id, name, tax_registered_name, location_tax_identifier, state, city", { count: "exact" })
      .eq("tenant_id", tenantId)
      .limit(1),
    supabase.from("accounts").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("tax_rate_registry").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("storefront_channels").select("*", { count: "exact", head: true }).eq("tenant_id", tenantId),
    supabase.from("return_policies").select("id, policy_name").eq("tenant_id", tenantId),
  ]);

  const step1Complete = (locationCount ?? 0) >= 1;
  const step2Complete = (accountCount ?? 0) >= 1;
  const step3Complete = (taxRateCount ?? 0) >= 1;
  const step4Complete = (channelCount ?? 0) >= 1;

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
    accountCount: accountCount ?? 0,
    taxRateCount: taxRateCount ?? 0,
    channelCount: channelCount ?? 0,
    returnPolicies: returnPolicies ?? [],
    steps,
    progressPercent: Math.round((completedSteps / 4) * 100),
    canLaunch: step1Complete && step2Complete && step3Complete && step4Complete,
    isOnboardingComplete,
  };
}

export async function getTenantIdFromSession(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return (user.app_metadata?.tenant_id as string) ?? null;
}
