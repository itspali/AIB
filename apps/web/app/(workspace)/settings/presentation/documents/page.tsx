import { Suspense } from "react";
import { DocumentTemplatesSettingsTerminalLazy } from "@/components/settings/document-templates/document-templates-settings-terminal-lazy";
import { fetchDocumentTemplatesModuleBundle } from "@/lib/documents/document-templates-module-bundle";
import { ensureTenantPresentationTemplates } from "@/lib/documents/print/presentation-queries";
import type { PresentationViewContext } from "@/lib/documents/print/types";
import type { DocumentModuleKey } from "@/lib/documents/types";
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
import { PRESENTATION_MODULE_DEFINITIONS } from "@/lib/documents/print/presentation-catalog";

const VALID_MODULE_KEYS = new Set<DocumentModuleKey>(
  PRESENTATION_MODULE_DEFINITIONS.map((row) => row.moduleKey)
);

const DEFAULT_PREVIEW_MODULE: DocumentModuleKey = "PURCHASE_ORDER";
const DEFAULT_PREVIEW_VIEW_CONTEXT: PresentationViewContext = "PDF_PRINT";

type PageProps = {
  searchParams: Promise<{ module?: string }>;
};

function parseModuleKey(raw: string | undefined): DocumentModuleKey | null {
  if (!raw || !VALID_MODULE_KEYS.has(raw as DocumentModuleKey)) return null;
  return raw as DocumentModuleKey;
}

function isProcurementModule(moduleKey: DocumentModuleKey): boolean {
  return (
    PRESENTATION_MODULE_DEFINITIONS.find((row) => row.moduleKey === moduleKey)?.domain ===
    "PROCUREMENT"
  );
}

export default async function DocumentTemplatesPage({ searchParams }: PageProps) {
  const { module: rawModule } = await searchParams;
  const initialModuleKey = parseModuleKey(rawModule);
  const previewModuleKey = initialModuleKey ?? DEFAULT_PREVIEW_MODULE;

  const { supabase, tenantId, userId } = await getModulePageContext();

  const [
    { ensured, error: deployError },
    access,
    locations,
    gstRegistered,
    initialModuleBundle,
    catalogFieldSuggestions,
  ] = await Promise.all([
    ensureTenantPresentationTemplates(supabase),
    resolveOrganizationSettingsAccess(supabase, userId, tenantId),
    fetchLocationRows(supabase, tenantId),
    fetchOrganizationGstRegistered(supabase, tenantId),
    fetchDocumentTemplatesModuleBundle(supabase, tenantId, previewModuleKey),
    isProcurementModule(previewModuleKey)
      ? fetchPoCatalogFieldSuggestions(supabase, tenantId)
      : Promise.resolve(undefined),
  ]);

  const locationOptions = locations
    .filter((row) => row.is_active)
    .map((row) => ({ id: row.id, name: row.name }));

  const previewLayout = normalizeDesignerPreviewLayout(
    previewModuleKey,
    DEFAULT_PREVIEW_VIEW_CONTEXT,
    initialModuleBundle.layoutsByViewContext.PDF_PRINT,
    gstRegistered
  );
  const previewShellBase =
    initialModuleBundle.presentationShells[DEFAULT_PREVIEW_VIEW_CONTEXT] ??
    DEFAULT_PRESENTATION_SHELL_CONFIG;
  const previewShell = applyGstShellConfigOverrides(
    previewModuleKey,
    previewShellBase,
    gstRegistered
  );
  const previewStyle =
    initialModuleBundle.presentationStyles[DEFAULT_PREVIEW_VIEW_CONTEXT] ??
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
    <Suspense
      fallback={
        <div className="flex h-full min-h-[480px] w-full items-center justify-center text-sm text-muted-foreground">
          Loading templates…
        </div>
      }
    >
      <DocumentTemplatesSettingsTerminalLazy
        locations={locationOptions}
        canEdit={access.granted}
        gstRegistered={gstRegistered}
        deployError={!ensured ? deployError : undefined}
        initialModuleKey={initialModuleKey}
        previewModuleKey={previewModuleKey}
        initialPreviewDraftKey={initialPreviewDraftKey}
        initialPreviewHtml={initialPreviewHtml}
        initialLayoutsByModule={{
          [previewModuleKey]: initialModuleBundle.layoutsByViewContext,
        }}
        initialPresentationShells={{
          [previewModuleKey]: initialModuleBundle.presentationShells,
        }}
        initialPresentationStyles={{
          [previewModuleKey]: initialModuleBundle.presentationStyles,
        }}
        catalogFieldSuggestions={catalogFieldSuggestions}
      />
    </Suspense>
  );
}
