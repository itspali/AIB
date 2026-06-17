import { notFound } from "next/navigation";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PresentationTemplatePanel } from "@/components/settings/document-templates/presentation-template-panel";
import { getPresentationModuleDefinition } from "@/lib/documents/print/presentation-catalog";
import {
  ensureTenantPresentationTemplates,
  fetchPresentationTemplatesForModule,
} from "@/lib/documents/print/presentation-queries";
import type { DocumentModuleKey } from "@/lib/documents/types";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchLocationRows } from "@/lib/locations/queries";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";

const MODULE_KEYS = new Set<DocumentModuleKey>([
  "PURCHASE_ORDER",
  "GOODS_RECEIPT_NOTE",
  "PURCHASE_INVOICE",
  "SALES_QUOTATION",
  "SALES_ORDER",
  "SALES_INVOICE",
]);

type PageProps = {
  params: Promise<{ moduleKey: string }>;
};

export default async function DocumentModuleTemplatePage({ params }: PageProps) {
  const { moduleKey: rawModuleKey } = await params;
  if (!MODULE_KEYS.has(rawModuleKey as DocumentModuleKey)) {
    notFound();
  }

  const moduleKey = rawModuleKey as DocumentModuleKey;
  const moduleDefinition = getPresentationModuleDefinition(moduleKey);
  if (!moduleDefinition) {
    notFound();
  }

  const { supabase, tenantId, userId, orgName, approvalAlertCount, operatorProfile } =
    await getModulePageContext();

  const [, access, initialTemplates, locations] = await Promise.all([
    ensureTenantPresentationTemplates(supabase),
    resolveOrganizationSettingsAccess(supabase, userId, tenantId),
    fetchPresentationTemplatesForModule(supabase, tenantId, moduleKey),
    fetchLocationRows(supabase, tenantId),
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
      <PresentationTemplatePanel
        moduleKey={moduleKey}
        moduleLabel={moduleDefinition.label}
        initialTemplates={initialTemplates}
        locations={locationOptions}
        canEdit={access.granted}
      />
    </DashboardShell>
  );
}
