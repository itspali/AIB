import { AdministrativeAccessDeniedView } from "@/components/settings/administrative-access-denied-view";
import { GroupSettingsTerminalLazy } from "@/components/settings/group/group-settings-terminal-lazy";
import { resolveGroupSettingsAccess } from "@/lib/group/access";
import {
  fetchGroupSettingsSnapshot,
  fetchPendingGroupInvitationsForGroup,
  fetchUserPrimaryGroupId,
} from "@/lib/group/queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { getSessionClaims } from "@/lib/supabase/auth";

export default async function GroupSettingsPage() {
  const { supabase, tenantId, userId } = await getModulePageContext();
  const claims = await getSessionClaims();

  const [orgAccess, { data: tenantRow }] = await Promise.all([
    resolveOrganizationSettingsAccess(supabase, userId, tenantId),
    supabase
      .from("tenants")
      .select("group_id, primary_email")
      .eq("id", tenantId)
      .maybeSingle(),
  ]);

  const groupId = await fetchUserPrimaryGroupId(
    supabase,
    userId,
    (tenantRow?.group_id as string | null) ?? null,
    claims?.groupId ?? null
  );

  const access = groupId
    ? await resolveGroupSettingsAccess(supabase, userId, groupId)
    : null;

  const [snapshot, pendingInvitations] = groupId
    ? await Promise.all([
        fetchGroupSettingsSnapshot(supabase, groupId),
        fetchPendingGroupInvitationsForGroup(supabase, groupId),
      ])
    : [null, []];

  if (groupId && access && !access.granted && snapshot) {
    return <AdministrativeAccessDeniedView />;
  }

  return (
    <GroupSettingsTerminalLazy
      snapshot={snapshot}
      access={access}
      canCreateGroup={orgAccess.isOwner}
      defaultEmail={claims?.email ?? tenantRow?.primary_email ?? ""}
      pendingInvitations={pendingInvitations}
    />
  );
}
