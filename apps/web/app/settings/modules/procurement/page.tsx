import { DashboardShell } from "@/components/layout/dashboard-shell";
import { ProcurementModuleSettingsTerminal } from "@/components/settings/modules/procurement-module-settings-terminal";
import { fetchDocumentLayoutTemplate } from "@/lib/documents/document-layout-queries";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchLocationRows } from "@/lib/locations/queries";
import { fetchPoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";

export default async function ProcurementModuleSettingsPage() {
  const { supabase, tenantId, userId, orgName, approvalAlertCount, operatorProfile } =
    await getModulePageContext();

  const [locations, access, catalogFieldSuggestions, initialLayout] = await Promise.all([
    fetchLocationRows(supabase, tenantId),
    resolveOrganizationSettingsAccess(supabase, userId, tenantId),
    fetchPoCatalogFieldSuggestions(supabase, tenantId),
    fetchDocumentLayoutTemplate(supabase, tenantId, "PURCHASE_ORDER", "SCREEN_GRID"),
  ]);

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
        initialLayout={initialLayout}
      />
    </DashboardShell>
  );
}
