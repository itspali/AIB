import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getModulePageContext } from "@/lib/layout/module-page";

type Props = {
  children: React.ReactNode;
  onboardingMode?: boolean;
  progressPercent?: number;
};

export async function ModuleDashboardShell({
  children,
  onboardingMode = false,
  progressPercent = 0,
}: Props) {
  const {
    orgName,
    approvalAlertCount,
    operatorProfile,
    tenantId,
    impersonation,
    workspaceDeletion,
  } = await getModulePageContext();

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
      impersonation={impersonation}
      onboardingMode={onboardingMode}
      progressPercent={progressPercent}
      workspaceDeletion={onboardingMode ? null : workspaceDeletion}
    >
      {children}
    </DashboardShell>
  );
}
