import { redirect } from "next/navigation";
import { ProfileSettingsTerminal } from "@/components/settings/profile-settings-terminal";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { getAvatarSignedUrl } from "@/lib/settings/avatar";
import { fetchProfileSettingsSnapshot } from "@/lib/settings/queries";
import { fetchApprovalAlertCount } from "@/lib/dashboard/queries";
import { fetchOnboardingSnapshot, getTenantIdFromSession } from "@/lib/onboarding/status";
import { fetchOperatorProfileForSession } from "@/lib/user/queries";
import { createClient } from "@/lib/supabase/server";

export default async function ProfileSettingsPage() {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession(supabase);

  if (!tenantId) redirect("/signup");

  const onboardingSnapshot = await fetchOnboardingSnapshot(supabase, tenantId);
  if (!onboardingSnapshot) redirect("/signup");

  if (!onboardingSnapshot.isOnboardingComplete) redirect("/onboarding");

  const orgName = onboardingSnapshot.tenant.trade_name || onboardingSnapshot.tenant.name;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [operatorProfile, approvalAlertCount, profileSnapshot] = await Promise.all([
    fetchOperatorProfileForSession(supabase, orgName),
    fetchApprovalAlertCount(supabase, tenantId),
    fetchProfileSettingsSnapshot(supabase, user.id, tenantId),
  ]);

  if (!profileSnapshot) {
    return (
      <DashboardShell
        orgName={orgName}
        approvalAlertCount={approvalAlertCount}
        operatorProfile={operatorProfile}
      >
        <p className="text-sm text-muted-foreground">Unable to load your profile settings.</p>
      </DashboardShell>
    );
  }

  const avatarPreviewUrl = await getAvatarSignedUrl(supabase, profileSnapshot.avatar_url);

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
    >
      <ProfileSettingsTerminal
        snapshot={profileSnapshot}
        tenantId={tenantId}
        avatarPreviewUrl={avatarPreviewUrl}
      />
    </DashboardShell>
  );
}
