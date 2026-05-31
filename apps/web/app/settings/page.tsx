import { Building2, Percent, UserCircle, Users } from "lucide-react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ModuleOverview } from "@/components/layout/module-overview";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function AdministrationPage() {
  const { orgName, approvalAlertCount, operatorProfile, tenantId } =
    await getModulePageContext();

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <ModuleOverview
        title="Administration"
        description="Configure organization-wide settings, tax, access, and your account. Document numbering lives inside Organization settings."
        cards={[
          {
            href: "/settings/organization",
            label: "Organization",
            description: "Identity, regional, billing, branding, locations, numbering, and accounting.",
            icon: Building2,
          },
          {
            href: "/settings/tax",
            label: "Tax",
            description: "Tax codes, rates, and rules used across pricing and documents.",
            icon: Percent,
          },
          {
            href: "/settings/users",
            label: "Users & Roles",
            description: "Team members, roles, and access delegation.",
            icon: Users,
            comingSoon: true,
          },
          {
            href: "/settings/profile",
            label: "My Account",
            description: "Your profile, security, and session preferences.",
            icon: UserCircle,
          },
        ]}
      />
    </DashboardShell>
  );
}
