import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchOnboardingSnapshot, getTenantIdFromSession } from "@/lib/onboarding/status";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { TenantProfileCard } from "@/components/onboarding/tenant-profile-card";
import { MilestoneChecklist } from "@/components/onboarding/milestone-checklist";

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
      <div className="space-y-8">
        <TenantProfileCard tenant={snapshot.tenant} progressPercent={snapshot.progressPercent} />
        <MilestoneChecklist snapshot={snapshot} />
      </div>
    </DashboardShell>
  );
}
