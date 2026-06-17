import { Suspense } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DocumentTemplatesSettingsTerminal } from "@/components/settings/document-templates/document-templates-settings-terminal";
import { ensureTenantPresentationTemplates } from "@/lib/documents/print/presentation-queries";
import type { DocumentModuleKey } from "@/lib/documents/types";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchLocationRows } from "@/lib/locations/queries";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { fetchOrganizationGstRegistered } from "@/lib/organization/gst-registration";

const VALID_MODULE_KEYS = new Set<DocumentModuleKey>([
  "PURCHASE_ORDER",
  "GOODS_RECEIPT_NOTE",
  "PURCHASE_INVOICE",
  "SALES_QUOTATION",
  "SALES_ORDER",
  "SALES_INVOICE",
]);

type PageProps = {
  searchParams: Promise<{ module?: string }>;
};

function parseModuleKey(raw: string | undefined): DocumentModuleKey | null {
  if (!raw || !VALID_MODULE_KEYS.has(raw as DocumentModuleKey)) return null;
  return raw as DocumentModuleKey;
}

export default async function DocumentTemplatesPage({ searchParams }: PageProps) {
  const { module: rawModule } = await searchParams;
  const initialModuleKey = parseModuleKey(rawModule);

  const { supabase, tenantId, userId, orgName, approvalAlertCount, operatorProfile } =
    await getModulePageContext();

  const [{ ensured, error: deployError }, access, locations, gstRegistered] = await Promise.all([
    ensureTenantPresentationTemplates(supabase),
    resolveOrganizationSettingsAccess(supabase, userId, tenantId),
    fetchLocationRows(supabase, tenantId),
    fetchOrganizationGstRegistered(supabase, tenantId),
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
      <Suspense
        fallback={
          <div className="flex h-full min-h-[480px] w-full items-center justify-center text-sm text-muted-foreground">
            Loading templates…
          </div>
        }
      >
        <DocumentTemplatesSettingsTerminal
          locations={locationOptions}
          canEdit={access.granted}
          gstRegistered={gstRegistered}
          deployError={!ensured ? deployError : undefined}
          initialModuleKey={initialModuleKey}
        />
      </Suspense>
    </DashboardShell>
  );
}
