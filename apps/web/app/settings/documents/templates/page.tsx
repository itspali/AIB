import { Suspense } from "react";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { DocumentTemplatesSettingsTerminal } from "@/components/settings/document-templates/document-templates-settings-terminal";
import { fetchDocumentLayoutTemplate } from "@/lib/documents/document-layout-queries";
import {
  ensureTenantPresentationTemplates,
  fetchDocumentPresentationTemplate,
} from "@/lib/documents/print/presentation-queries";
import type {
  DocumentPresentationTemplate,
  PresentationShellConfig,
  PresentationStyleConfig,
  PresentationViewContext,
} from "@/lib/documents/print/types";
import type { DocumentLayoutTemplate, DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";
import { getModulePageContext } from "@/lib/layout/module-page";
import { fetchLocationRows } from "@/lib/locations/queries";
import { resolveOrganizationSettingsAccess } from "@/lib/organization/access";
import { fetchOrganizationGstRegistered } from "@/lib/organization/gst-registration";
import { TENANT_LAYOUT_SCOPE } from "@/lib/documents/layout-scope";
import {
  DEFAULT_PRESENTATION_SHELL_CONFIG,
  DEFAULT_PRESENTATION_STYLE_CONFIG,
} from "@/lib/documents/print/default-shell-config";
import { applyGstShellConfigOverrides } from "@/lib/documents/print/gst-presentation-compliance";
import {
  buildDesignerPreviewDraftKey,
  normalizeDesignerPreviewLayout,
} from "@/lib/documents/print/designer-preview-draft";
import { renderDocumentDesignerPreviewHtml } from "@/lib/documents/print/render-designer-preview";
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
const LAYOUT_VIEW_CONTEXTS: DocumentViewContext[] = ["SCREEN_GRID", "PDF_PRINT", "EMAIL_HTML"];
const PRESENTATION_VIEW_CONTEXTS: PresentationViewContext[] = ["PDF_PRINT", "EMAIL_HTML"];
const DEFAULT_PREVIEW_MODULE: DocumentModuleKey = "PURCHASE_ORDER";
const DEFAULT_PREVIEW_VIEW_CONTEXT: PresentationViewContext = "PDF_PRINT";

type ModulePresentationShells = Record<PresentationViewContext, PresentationShellConfig>;
type ModulePresentationStyles = Record<PresentationViewContext, PresentationStyleConfig>;

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
    ...MODULE_KEYS.flatMap((moduleKey) =>
      LAYOUT_VIEW_CONTEXTS.map((viewContext) =>
        fetchDocumentLayoutTemplate(supabase, tenantId, moduleKey, viewContext)
      )
    ),
    ...MODULE_KEYS.flatMap((moduleKey) =>
      PRESENTATION_VIEW_CONTEXTS.map((viewContext) =>
        fetchDocumentPresentationTemplate(supabase, tenantId, moduleKey, viewContext)
      )
    ),
  ]);

  const layoutRowCount = MODULE_KEYS.length * LAYOUT_VIEW_CONTEXTS.length;
  const layoutRows = layoutAndPresentationRows.slice(0, layoutRowCount) as DocumentLayoutTemplate[];
  const presentationRows = layoutAndPresentationRows.slice(
    layoutRowCount
  ) as DocumentPresentationTemplate[];

  const initialLayoutsByModule = Object.fromEntries(
    MODULE_KEYS.map((moduleKey, moduleIndex) => {
      const byContext = Object.fromEntries(
        LAYOUT_VIEW_CONTEXTS.map((viewContext, viewIndex) => {
          const flatIndex = moduleIndex * LAYOUT_VIEW_CONTEXTS.length + viewIndex;
          return [viewContext, layoutRows[flatIndex]!];
        })
      ) as Record<DocumentViewContext, DocumentLayoutTemplate>;
      return [moduleKey, byContext];
    })
  ) as Record<DocumentModuleKey, Record<DocumentViewContext, DocumentLayoutTemplate>>;

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

  const initialPresentationStyles = Object.fromEntries(
    MODULE_KEYS.map((moduleKey, moduleIndex) => {
      const styles = Object.fromEntries(
        PRESENTATION_VIEW_CONTEXTS.map((viewContext, viewIndex) => {
          const flatIndex = moduleIndex * PRESENTATION_VIEW_CONTEXTS.length + viewIndex;
          return [viewContext, presentationRows[flatIndex]!.styleConfig];
        })
      ) as ModulePresentationStyles;
      return [moduleKey, styles];
    })
  ) as Record<DocumentModuleKey, ModulePresentationStyles>;

  const locationOptions = locations
    .filter((row) => row.is_active)
    .map((row) => ({ id: row.id, name: row.name }));

  const previewModuleKey = initialModuleKey ?? DEFAULT_PREVIEW_MODULE;
  const previewLayout = normalizeDesignerPreviewLayout(
    previewModuleKey,
    DEFAULT_PREVIEW_VIEW_CONTEXT,
    initialLayoutsByModule[previewModuleKey].PDF_PRINT,
    gstRegistered
  );
  const previewShellBase =
    initialPresentationShells[previewModuleKey][DEFAULT_PREVIEW_VIEW_CONTEXT] ??
    DEFAULT_PRESENTATION_SHELL_CONFIG;
  const previewShell = applyGstShellConfigOverrides(
    previewModuleKey,
    previewShellBase,
    gstRegistered
  );
  const previewStyle =
    initialPresentationStyles[previewModuleKey][DEFAULT_PREVIEW_VIEW_CONTEXT] ??
    DEFAULT_PRESENTATION_STYLE_CONFIG;
  const initialPreviewDraftKey = buildDesignerPreviewDraftKey({
    moduleKey: previewModuleKey,
    viewContext: DEFAULT_PREVIEW_VIEW_CONTEXT,
    scope: TENANT_LAYOUT_SCOPE,
    layout: previewLayout,
    shellConfig: previewShell,
    styleConfig: previewStyle,
  });
  const initialPreviewResult = await renderDocumentDesignerPreviewHtml(supabase, tenantId, {
    moduleKey: previewModuleKey,
    viewContext: DEFAULT_PREVIEW_VIEW_CONTEXT,
    scope: TENANT_LAYOUT_SCOPE,
    layout: previewLayout,
    shellConfig: previewShell,
    styleConfig: previewStyle,
  });
  const initialPreviewHtml =
    "html" in initialPreviewResult ? initialPreviewResult.html : null;

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
          previewModuleKey={previewModuleKey}
          initialPreviewDraftKey={initialPreviewDraftKey}
          initialPreviewHtml={initialPreviewHtml}
          initialLayoutsByModule={initialLayoutsByModule}
          initialPresentationShells={initialPresentationShells}
          initialPresentationStyles={initialPresentationStyles}
          catalogFieldSuggestions={catalogFieldSuggestions}
        />
      </Suspense>
    </DashboardShell>
  );
}
