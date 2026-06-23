import { ProfileSettingsTerminalLazy } from "@/components/settings/profile-settings-terminal-lazy";
import { getAvatarSignedUrl } from "@/lib/settings/avatar";
import { fetchProfileSettingsSnapshot } from "@/lib/settings/queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function ProfileSettingsPage() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const profileSnapshot = await fetchProfileSettingsSnapshot(supabase, userId, tenantId);
  if (!profileSnapshot) {
    return (
      <p className="text-sm text-muted-foreground">Unable to load your profile settings.</p>
    );
  }

  const avatarPreviewUrl = await getAvatarSignedUrl(supabase, profileSnapshot.avatar_url);

  return (
    <ProfileSettingsTerminalLazy
      snapshot={profileSnapshot}
      tenantId={tenantId}
      avatarPreviewUrl={avatarPreviewUrl}
    />
  );
}
