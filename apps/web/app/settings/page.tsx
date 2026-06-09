import {
  Building2,
  LayoutTemplate,
  MapPin,
  Network,
  Receipt,
  Ruler,
  Shield,
  User,
} from "lucide-react";
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
        description="Workspace governance — organization profile, enterprise group, locations, tax, and access."
        cards={[
          {
            href: "/settings/organization",
            label: "Organization",
            description: "Legal identity, billing, branding, accounting defaults, and access delegates.",
            icon: Building2,
          },
          {
            href: "/settings/group",
            label: "Group",
            description: "Enterprise group profile, subsidiary organizations, and workspace membership.",
            icon: Network,
          },
          {
            href: "/settings/locations",
            label: "Locations",
            description: "Warehouses, stores, document numbering, and location governance.",
            icon: MapPin,
          },
          {
            href: "/settings/modules",
            label: "Module settings",
            description: "Document layouts, module policies, and operational preferences by module.",
            icon: LayoutTemplate,
          },
          {
            href: "/settings/uom",
            label: "Units of Measure",
            description: "Base units, conversions, and catalog measurement standards.",
            icon: Ruler,
          },
          {
            href: "/settings/tax",
            label: "Tax",
            description: "Tax components, rates, and filing configuration.",
            icon: Receipt,
          },
          {
            href: "/settings/users",
            label: "Users & Roles",
            description: "Team members, roles, and duty status.",
            icon: Shield,
            comingSoon: true,
          },
          {
            href: "/settings/profile",
            label: "My Account",
            description: "Personal profile, password, and notification preferences.",
            icon: User,
          },
        ]}
      />
    </DashboardShell>
  );
}
