import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getOnboardingPageContext } from "@/lib/onboarding/page-context";

export default async function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { orgName, operatorProfile, tenantId, snapshot, workspaceReady } =
    await getOnboardingPageContext();

  return (
    <DashboardShell
      orgName={orgName}
      progressPercent={snapshot.progressPercent}
      onboardingMode={!workspaceReady}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      {children}
    </DashboardShell>
  );
}
