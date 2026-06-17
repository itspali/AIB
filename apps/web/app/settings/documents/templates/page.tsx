import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DocumentTemplatesHub } from "@/components/settings/document-templates/document-templates-hub";
import { ensureTenantPresentationTemplates } from "@/lib/documents/print/presentation-queries";
import { getModulePageContext } from "@/lib/layout/module-page";

export default async function DocumentTemplatesPage() {
  const { supabase, tenantId, orgName, approvalAlertCount, operatorProfile } =
    await getModulePageContext();

  const { ensured, error: deployError } = await ensureTenantPresentationTemplates(supabase);

  return (
    <DashboardShell
      orgName={orgName}
      approvalAlertCount={approvalAlertCount}
      operatorProfile={operatorProfile}
      tenantId={tenantId}
    >
      <DocumentTemplatesHub deployError={!ensured ? deployError : undefined} />
    </DashboardShell>
  );
}
