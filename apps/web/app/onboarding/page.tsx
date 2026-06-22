import { TenantProfileCard } from "@/components/onboarding/tenant-profile-card";
import { OnboardingWizardLazy } from "@/components/onboarding/onboarding-wizard-lazy";
import { getOnboardingPageContext } from "@/lib/onboarding/page-context";

export default async function OnboardingPage() {
  const { snapshot, workspaceReady, signupCountryCode } = await getOnboardingPageContext();

  return (
    <div className="space-y-4 md:space-y-8 min-w-0">
      <TenantProfileCard
        tenant={snapshot.tenant}
        progressPercent={snapshot.progressPercent}
        showDashboardExit={workspaceReady}
      />
      <OnboardingWizardLazy snapshot={snapshot} signupCountryCode={signupCountryCode} />
    </div>
  );
}
