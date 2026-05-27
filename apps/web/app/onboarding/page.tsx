import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchOnboardingSnapshot, getTenantIdFromSession } from "@/lib/onboarding/status";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TenantProfileCard } from "@/components/onboarding/tenant-profile-card";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);

  if (!tenantId) redirect("/signup");

  const snapshot = await fetchOnboardingSnapshot(supabase, tenantId);
  if (!snapshot) redirect("/signup");

  return (
    <DashboardShell
      orgName={snapshot.tenant.trade_name || snapshot.tenant.name}
      progressPercent={snapshot.progressPercent}
      onboardingMode
    >
      <div className="space-y-4 md:space-y-8 min-w-0">
        <TenantProfileCard tenant={snapshot.tenant} progressPercent={snapshot.progressPercent} />
        <OnboardingWizard snapshot={snapshot} />
      </div>
    </DashboardShell>
  );
}
