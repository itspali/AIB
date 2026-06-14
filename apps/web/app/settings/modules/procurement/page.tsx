import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProcurementModuleSettingsTerminal } from "@/components/settings/modules/procurement-module-settings-terminal";
import { fetchDocumentLayoutTemplate } from "@/lib/documents/document-layout-queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchLocationRows } from "@/lib/locations/queries";
import { fetchPoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";
import { fetchProcurementApprovalSettings } from "@/lib/procurement/approval-settings";
import {
  fetchExpenseAccountOptions,
  fetchFinancialProcurementSettings,
  fetchLiabilityAccountOptions,
  fetchProcurementSettings,
} from "@/lib/procurement/settings";
import {
  fetchWorkspaceEligibleUsers,
  fetchWorkspaceUserProfiles,
} from "@/lib/organization/queries";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";

export default async function ProcurementModuleSettingsPage() {
  const { supabase, tenantId, userId, orgName, approvalAlertCount, operatorProfile } =
    await getModulePageContext();

  const [locations, access, catalogFieldSuggestions, initialPoLayout, initialGrnLayout, initialBillLayout, procurementSettings, approvalSettings, eligibleUsers, financialSettings, expenseAccounts, liabilityAccounts] =
    await Promise.all([
    fetchLocationRows(supabase, tenantId),
    resolveOrganizationSettingsAccess(supabase, userId, tenantId),
    fetchPoCatalogFieldSuggestions(supabase, tenantId),
    fetchDocumentLayoutTemplate(supabase, tenantId, "PURCHASE_ORDER", "SCREEN_GRID"),
    fetchDocumentLayoutTemplate(supabase, tenantId, "GOODS_RECEIPT_NOTE", "SCREEN_GRID"),
    fetchDocumentLayoutTemplate(supabase, tenantId, "PURCHASE_INVOICE", "SCREEN_GRID"),
    fetchProcurementSettings(supabase, tenantId),
    fetchProcurementApprovalSettings(supabase, tenantId),
    fetchWorkspaceEligibleUsers(supabase, tenantId),
    fetchFinancialProcurementSettings(supabase, tenantId),
    fetchExpenseAccountOptions(supabase, tenantId),
    fetchLiabilityAccountOptions(supabase, tenantId),
  ]);

  const approverProfiles = await fetchWorkspaceUserProfiles(
    supabase,
    approvalSettings.po_approver_user_ids
  );

  const locationOptions = locations
    .filter((row) => row.is_active)
    .map((row) => ({ id: row.id, name: row.name }));

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <ProcurementModuleSettingsTerminal
        locations={locationOptions}
        canEdit={access.granted}
        catalogFieldSuggestions={catalogFieldSuggestions}
        initialPoLayout={initialPoLayout}
        initialGrnLayout={initialGrnLayout}
        initialBillLayout={initialBillLayout}
        procurementSettings={procurementSettings}
        approvalSettings={approvalSettings}
        eligibleUsers={eligibleUsers}
        approverProfiles={approverProfiles}
        financialSettings={financialSettings}
        expenseAccounts={expenseAccounts}
        liabilityAccounts={liabilityAccounts}
      />
    </DashboardShell>
  );
}
