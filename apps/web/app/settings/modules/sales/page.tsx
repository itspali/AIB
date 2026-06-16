import { DashboardShell } from "@/components/layout/dashboard-shell";
import { SalesModuleSettingsTerminal } from "@/components/settings/modules/sales-module-settings-terminal";
import { fetchDocumentLayoutTemplate } from "@/lib/documents/document-layout-queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchLocationRows } from "@/lib/locations/queries";
import { fetchPoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";
import {
  fetchWorkspaceEligibleUsers,
  fetchWorkspaceUserProfiles,
} from "@/lib/organization/queries";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { fetchOrganizationGstRegistered } from "@/lib/organization/gst-registration";
import { fetchSalesApprovalSettings } from "@/lib/sales/approval-settings-server";
import { fetchSalesSettings } from "@/lib/sales/settings";

export default async function SalesModuleSettingsPage() {
  const { supabase, tenantId, userId, orgName, approvalAlertCount, operatorProfile } =
    await getModulePageContext();

  const [
    locations,
    access,
    gstRegistered,
    catalogFieldSuggestions,
    initialQuoteLayout,
    initialOrderLayout,
    initialInvoiceLayout,
    approvalSettings,
    salesSettings,
    eligibleUsers,
  ] = await Promise.all([
    fetchLocationRows(supabase, tenantId),
    resolveOrganizationSettingsAccess(supabase, userId, tenantId),
    fetchOrganizationGstRegistered(supabase, tenantId),
    fetchPoCatalogFieldSuggestions(supabase, tenantId),
    fetchDocumentLayoutTemplate(supabase, tenantId, "SALES_QUOTATION", "SCREEN_GRID"),
    fetchDocumentLayoutTemplate(supabase, tenantId, "SALES_ORDER", "SCREEN_GRID"),
    fetchDocumentLayoutTemplate(supabase, tenantId, "SALES_INVOICE", "SCREEN_GRID"),
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
      <SalesModuleSettingsTerminal
        locations={locationOptions}
        canEdit={access.granted}
        gstRegistered={gstRegistered}
        catalogFieldSuggestions={catalogFieldSuggestions}
        initialQuoteLayout={initialQuoteLayout}
        initialOrderLayout={initialOrderLayout}
        initialInvoiceLayout={initialInvoiceLayout}
        approvalSettings={approvalSettings}
        documentConversionMode={salesSettings.document_conversion_mode}
        eligibleUsers={eligibleUsers}
        approverProfiles={approverProfiles}
      />
    </DashboardShell>
  );
}
