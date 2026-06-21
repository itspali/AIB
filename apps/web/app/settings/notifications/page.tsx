import { NotificationSettingsTerminal } from "@/components/settings/notifications/notification-settings-terminal";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchNotificationTemplateGroups } from "@/lib/notifications/queries";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";

export default async function NotificationSettingsPage() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [{ groups, deployError }, access] = await Promise.all([
    fetchNotificationTemplateGroups(supabase, tenantId),
    resolveOrganizationSettingsAccess(supabase, userId, tenantId),
  ]);

  return (
    <NotificationSettingsTerminal
      initialGroups={groups}
      canEdit={access.granted}
      deployError={deployError}
    />
  );
}
