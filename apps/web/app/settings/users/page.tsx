import { Users } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function UsersAndRolesPage() {
  const { orgName, approvalAlertCount, operatorProfile, tenantId } =
    await getModulePageContext();

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <ComingSoonModule
        title="Users & Roles"
        description="Invite team members, assign roles, and delegate administrative access."
        icon={Users}
        plannedSections={["Members", "Roles", "Delegations", "Invitations"]}
      />
    </DashboardShell>
  );
}
