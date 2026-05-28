import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchOnboardingSnapshot, getTenantIdFromSession } from "@/lib/onboarding/status";
import { fetchOperatorProfileForSession } from "@/lib/user/queries";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TenantProfileCard } from "@/components/onboarding/tenant-profile-card";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);

  if (!tenantId) redirect("/signup");

  const snapshot = await fetchOnboardingSnapshot(supabase, tenantId);
  if (!snapshot) redirect("/signup");

  const orgName = snapshot.tenant.trade_name || snapshot.tenant.name;
  const operatorProfile = await fetchOperatorProfileForSession(supabase, orgName);

  return (
    <DashboardShell
      orgName={orgName}
      progressPercent={snapshot.progressPercent}
      onboardingMode
      operatorProfile={operatorProfile}
    >
      <div className="space-y-4 md:space-y-8 min-w-0">
        <TenantProfileCard tenant={snapshot.tenant} progressPercent={snapshot.progressPercent} />
        <OnboardingWizard snapshot={snapshot} />
      </div>
    </DashboardShell>
  );
}
