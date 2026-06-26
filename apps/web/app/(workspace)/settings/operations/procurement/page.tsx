import { ProcurementModuleSettingsTerminal } from "@/components/settings/modules/procurement-module-settings-terminal";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchProcurementApprovalSettings } from "@/lib/procurement/approval-settings-server";
import {
  fetchExpenseAccountOptions,
  fetchAssetAccountOptions,
  fetchFinancialProcurementSettings,
  fetchLiabilityAccountOptions,
  fetchProcurementSettings,
} from "@/lib/procurement/settings";
import {
  fetchWorkspaceEligibleUsers,
  fetchWorkspaceUserProfiles,
} from "@/lib/organization/queries";
import { fetchImportLogisticsSettings } from "@/lib/procurement/import-logistics-settings";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";

export default async function ProcurementModuleSettingsPage() {
  const { supabase, tenantId, userId } = await getModulePageContext();

  const [
    access,
    procurementSettings,
    approvalSettings,
    eligibleUsers,
    financialSettings,
    expenseAccounts,
    assetAccounts,
    liabilityAccounts,
    importLogisticsSettings,
  ] = await Promise.all([
    resolveOrganizationSettingsAccess(supabase, userId, tenantId),
    fetchProcurementSettings(supabase, tenantId),
    fetchProcurementApprovalSettings(supabase, tenantId),
    fetchWorkspaceEligibleUsers(supabase, tenantId),
    fetchFinancialProcurementSettings(supabase, tenantId),
    fetchExpenseAccountOptions(supabase, tenantId),
    fetchAssetAccountOptions(supabase, tenantId),
    fetchLiabilityAccountOptions(supabase, tenantId),
    fetchImportLogisticsSettings(supabase, tenantId),
  ]);

  const approverProfiles = await fetchWorkspaceUserProfiles(
    supabase,
    approvalSettings.po_approver_user_ids
  );

  return (
    <ProcurementModuleSettingsTerminal
      canEdit={access.granted}
      procurementSettings={procurementSettings}
      approvalSettings={approvalSettings}
      eligibleUsers={eligibleUsers}
      approverProfiles={approverProfiles}
      financialSettings={financialSettings}
      expenseAccounts={expenseAccounts}
      assetAccounts={assetAccounts}
      liabilityAccounts={liabilityAccounts}
      importLogisticsSettings={importLogisticsSettings}
    />
  );
}
