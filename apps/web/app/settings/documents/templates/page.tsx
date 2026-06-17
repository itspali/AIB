import { Suspense } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DocumentTemplatesSettingsTerminal } from "@/components/settings/document-templates/document-templates-settings-terminal";
import { fetchDocumentLayoutTemplate } from "@/lib/documents/document-layout-queries";
import {
  ensureTenantPresentationTemplates,
  fetchDocumentPresentationTemplate,
} from "@/lib/documents/print/presentation-queries";
import type { PresentationShellConfig, PresentationViewContext } from "@/lib/documents/print/types";
import type { DocumentLayoutTemplate, DocumentModuleKey } from "@/lib/documents/types";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchLocationRows } from "@/lib/locations/queries";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { fetchOrganizationGstRegistered } from "@/lib/organization/gst-registration";
import { fetchPoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";

const VALID_MODULE_KEYS = new Set<DocumentModuleKey>([
  "PURCHASE_ORDER",
  "GOODS_RECEIPT_NOTE",
  "PURCHASE_INVOICE",
  "SALES_QUOTATION",
  "SALES_ORDER",
  "SALES_INVOICE",
]);

const MODULE_KEYS = [...VALID_MODULE_KEYS] as DocumentModuleKey[];
const PRESENTATION_VIEW_CONTEXTS: PresentationViewContext[] = ["PDF_PRINT", "EMAIL_HTML"];

type ModulePresentationShells = Record<PresentationViewContext, PresentationShellConfig>;

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

  const [
    { ensured, error: deployError },
    access,
    locations,
    gstRegistered,
    catalogFieldSuggestions,
    ...layoutAndPresentationRows
  ] = await Promise.all([
    ensureTenantPresentationTemplates(supabase),
    resolveOrganizationSettingsAccess(supabase, userId, tenantId),
    fetchLocationRows(supabase, tenantId),
    fetchOrganizationGstRegistered(supabase, tenantId),
    fetchPoCatalogFieldSuggestions(supabase, tenantId),
    ...MODULE_KEYS.map((moduleKey) =>
      fetchDocumentLayoutTemplate(supabase, tenantId, moduleKey, "PDF_PRINT")
    ),
    ...MODULE_KEYS.flatMap((moduleKey) =>
      PRESENTATION_VIEW_CONTEXTS.map((viewContext) =>
        fetchDocumentPresentationTemplate(supabase, tenantId, moduleKey, viewContext)
      )
    ),
  ]);

  const layoutRows = layoutAndPresentationRows.slice(0, MODULE_KEYS.length);
  const presentationRows = layoutAndPresentationRows.slice(MODULE_KEYS.length);

  const initialLayouts = Object.fromEntries(
    MODULE_KEYS.map((moduleKey, index) => [moduleKey, layoutRows[index]])
  ) as Record<DocumentModuleKey, DocumentLayoutTemplate>;

  const initialPresentationShells = Object.fromEntries(
    MODULE_KEYS.map((moduleKey, moduleIndex) => {
      const shells = Object.fromEntries(
        PRESENTATION_VIEW_CONTEXTS.map((viewContext, viewIndex) => {
          const flatIndex = moduleIndex * PRESENTATION_VIEW_CONTEXTS.length + viewIndex;
          return [viewContext, presentationRows[flatIndex]!.shellConfig];
        })
      ) as ModulePresentationShells;
      return [moduleKey, shells];
    })
  ) as Record<DocumentModuleKey, ModulePresentationShells>;

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
          initialLayouts={initialLayouts}
          initialPresentationShells={initialPresentationShells}
          catalogFieldSuggestions={catalogFieldSuggestions}
        />
      </Suspense>
    </DashboardShell>
  );
}
