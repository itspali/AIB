import { SalesModuleSettingsTerminal } from "@/components/settings/modules/sales-module-settings-terminal";
import { getModulePageContext } from "@/lib/layout/module-page";
import {
  fetchWorkspaceEligibleUsers,
  fetchWorkspaceUserProfiles,
} from "@/lib/organization/queries";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { fetchSalesApprovalSettings } from "@/lib/sales/approval-settings-server";
import { fetchSalesSettings } from "@/lib/sales/settings";

export default async function SalesModuleSettingsPage() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [access, approvalSettings, salesSettings, eligibleUsers] = await Promise.all([
    resolveOrganizationSettingsAccess(supabase, userId, tenantId),
    fetchSalesApprovalSettings(supabase, tenantId),
    fetchSalesSettings(supabase, tenantId),
    fetchWorkspaceEligibleUsers(supabase, tenantId),
  ]);

  const approverUserIds = [
    ...new Set([
      ...approvalSettings.so_approver_user_ids,
      ...approvalSettings.quote_approver_user_ids,
      ...approvalSettings.invoice_approver_user_ids,
    ]),
  ];

  const approverProfiles = await fetchWorkspaceUserProfiles(supabase, approverUserIds);

  return (
    <SalesModuleSettingsTerminal
      canEdit={access.granted}
      approvalSettings={approvalSettings}
      documentConversionMode={salesSettings.document_conversion_mode}
      eligibleUsers={eligibleUsers}
      approverProfiles={approverProfiles}
    />
  );
}
