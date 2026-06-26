import { Users } from "lucide-react";
import { ComingSoonModule } from "@/components/layout/coming-soon-module";

export default function UsersAndRolesPage() {
  return (
    <ComingSoonModule
      title="Users & Roles"
      description="Invite team members, assign roles, and delegate administrative access."
      icon={Users}
      plannedSections={["Members", "Roles", "Delegations", "Invitations"]}
    />
  );
}
