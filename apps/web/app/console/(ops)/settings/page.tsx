import { Shield, SlidersHorizontal, Users } from "lucide-react";
import { ModuleOverview } from "@/components/layout/module-overview";

export default function ConsoleSettingsPage() {
  return (
    <ModuleOverview
      title="Console settings"
      description="Platform governance — operators, feature flags, and security."
      cards={[
        {
          href: "/console/settings/admins",
          label: "Operators",
          description: "Grant and manage internal console access for your team.",
          icon: Users,
        },
        {
          href: "/console/settings/platform",
          label: "Platform config",
          description: "Signup, maintenance mode, MFA policy, and trial expiry behavior.",
          icon: SlidersHorizontal,
        },
        {
          href: "/console/settings/security",
          label: "Security",
          description: "Enroll authenticator MFA for your operator account.",
          icon: Shield,
        },
      ]}
    />
  );
}
