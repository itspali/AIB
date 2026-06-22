import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { orgName, approvalAlertCount, operatorProfile, tenantId, impersonation } =
    await getModulePageContext();

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
      impersonation={impersonation}
    >
      {children}
    </DashboardShell>
  );
}
