import { redirect } from "next/navigation";
import { AdministrativeAccessDeniedView } from "@/components/settings/administrative-access-denied-view";
import { GroupSettingsTerminal } from "@/components/settings/group/group-settings-terminal";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { resolveGroupSettingsAccess } from "@/lib/group/access";
import {
  fetchGroupSettingsSnapshot,
  fetchUserPrimaryGroupId,
} from "@/lib/group/queries";
import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { fetchOnboardingSnapshot, hasWorkspaceAccess } from "@/lib/onboarding/status";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { fetchOperatorProfileForSession } from "@/lib/user/queries";
import { getSessionClaims } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export default async function GroupSettingsPage() {
  const [supabase, claims] = await Promise.all([createClient(), getSessionClaims()]);

  if (!claims?.tenantId) redirect("/signup");
  const tenantId = claims.tenantId;

  const onboardingSnapshot = await fetchOnboardingSnapshot(supabase, tenantId);
  if (!onboardingSnapshot) redirect("/signup");
  if (!hasWorkspaceAccess(onboardingSnapshot)) redirect("/onboarding");

  const orgName = onboardingSnapshot.tenant.trade_name || onboardingSnapshot.tenant.name;

  const [operatorProfile, approvalAlertCount, orgAccess] = await Promise.all([
    fetchOperatorProfileForSession(supabase, orgName),
    fetchApprovalAlertCount(supabase, tenantId),
    resolveOrganizationSettingsAccess(supabase, claims.userId, tenantId),
  ]);

  const { data: tenantRow } = await supabase
    .from("tenants")
    .select("group_id, primary_email")
    .eq("id", tenantId)
    .maybeSingle();

  const groupId = await fetchUserPrimaryGroupId(
    supabase,
    claims.userId,
    (tenantRow?.group_id as string | null) ?? null,
    claims.groupId
  );

  const access = groupId
    ? await resolveGroupSettingsAccess(supabase, claims.userId, groupId)
    : null;

  const snapshot = groupId ? await fetchGroupSettingsSnapshot(supabase, groupId) : null;

  if (groupId && access && !access.granted && snapshot) {
    return (
      <DashboardShell
        orgName={orgName}
        approvalAlertCount={approvalAlertCount}
        operatorProfile={operatorProfile}
        tenantId={tenantId}
      >
        <AdministrativeAccessDeniedView />
      </DashboardShell>
    );
  }

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <GroupSettingsTerminal
        snapshot={snapshot}
        access={access}
        canCreateGroup={orgAccess.isOwner}
        defaultEmail={claims.email ?? tenantRow?.primary_email ?? ""}
      />
    </DashboardShell>
  );
}
