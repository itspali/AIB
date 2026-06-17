"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileOutput } from "lucide-react";
import { DocumentDesignerWorkspace } from "@/components/settings/document-templates/document-designer-workspace";
import { DocumentTemplatesContextToolbar } from "@/components/settings/document-templates/document-templates-context-toolbar";
import type { DocumentLayoutLocationOption } from "@/components/settings/document-layout/document-layout-scope-select";
import type { DocumentLayoutEmbeddedToolbarActions } from "@/components/settings/document-layout/document-layout-panel";
import {
  PRESENTATION_MODULE_DEFINITIONS,
  groupPresentationModulesByDomain,
} from "@/lib/documents/print/presentation-catalog";
import type { PresentationModuleDefinition } from "@/lib/documents/print/types";
import type { PresentationShellConfig, PresentationStyleConfig, PresentationViewContext } from "@/lib/documents/print/types";
import { TENANT_LAYOUT_SCOPE, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
import type { DocumentLayoutTemplate, DocumentModuleKey } from "@/lib/documents/types";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";

type ModulePresentationShells = Record<PresentationViewContext, PresentationShellConfig>;
type ModulePresentationStyles = Record<PresentationViewContext, PresentationStyleConfig>;

const MODULE_QUERY = "module";

const VALID_MODULE_KEYS = new Set<DocumentModuleKey>(
  PRESENTATION_MODULE_DEFINITIONS.map((row) => row.moduleKey)
);

function parseModuleKey(raw: string | null): DocumentModuleKey | null {
  if (!raw || !VALID_MODULE_KEYS.has(raw as DocumentModuleKey)) return null;
  return raw as DocumentModuleKey;
}

type Props = {
  locations: DocumentLayoutLocationOption[];
  canEdit: boolean;
  gstRegistered: boolean;
  deployError?: string;
  initialModuleKey?: DocumentModuleKey | null;
  previewModuleKey: DocumentModuleKey;
  initialPreviewDraftKey: string;
  initialPreviewHtml: string | null;
  initialLayoutsByModule: Record<
    DocumentModuleKey,
    Record<PresentationViewContext, DocumentLayoutTemplate>
  >;
  initialPresentationShells: Record<DocumentModuleKey, ModulePresentationShells>;
  initialPresentationStyles: Record<DocumentModuleKey, ModulePresentationStyles>;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
};

export function DocumentTemplatesSettingsTerminal({
  locations,
  canEdit,
  gstRegistered,
  deployError,
  initialModuleKey,
  previewModuleKey,
  initialPreviewDraftKey,
  initialPreviewHtml,
  initialLayoutsByModule,
  initialPresentationShells,
  initialPresentationStyles,
  catalogFieldSuggestions,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const groups = useMemo(() => groupPresentationModulesByDomain(), []);

  const queryModule = parseModuleKey(searchParams.get(MODULE_QUERY));
  const [domain, setDomain] = useState<"PROCUREMENT" | "SALES">(() => {
    const key = queryModule ?? initialModuleKey ?? "PURCHASE_ORDER";
    const definition = PRESENTATION_MODULE_DEFINITIONS.find((row) => row.moduleKey === key);
    return definition?.domain ?? "PROCUREMENT";
  });
  const [viewContext, setViewContext] = useState<PresentationViewContext>("PDF_PRINT");
  const [scope, setScope] = useState<DocumentLayoutScope>(TENANT_LAYOUT_SCOPE);
  const [designerTab, setDesignerTab] = useState<"fields" | "appearance">("fields");
  const [fieldToolbarActions, setFieldToolbarActions] =
    useState<DocumentLayoutEmbeddedToolbarActions | null>(null);

  useEffect(() => {
    if (!queryModule) return;
    const definition = PRESENTATION_MODULE_DEFINITIONS.find((row) => row.moduleKey === queryModule);
    if (definition && definition.domain !== domain) {
      setDomain(definition.domain);
    }
  }, [queryModule, domain]);

  const selectedModuleKey = useMemo(() => {
    const fromQuery = queryModule;
    if (fromQuery) {
      const definition = PRESENTATION_MODULE_DEFINITIONS.find((row) => row.moduleKey === fromQuery);
      if (definition?.domain === domain) return fromQuery;
    }
    return groups[domain][0]?.moduleKey ?? "PURCHASE_ORDER";
  }, [queryModule, domain, groups]);

  const selectedModule = useMemo(
    () => PRESENTATION_MODULE_DEFINITIONS.find((row) => row.moduleKey === selectedModuleKey) ?? null,
    [selectedModuleKey]
  );

  useEffect(() => {
    setViewContext("PDF_PRINT");
    setScope(TENANT_LAYOUT_SCOPE);
    setDesignerTab("fields");
    setFieldToolbarActions(null);
  }, [selectedModuleKey]);

  const selectModule = useCallback(
    (module: PresentationModuleDefinition) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(MODULE_QUERY, module.moduleKey);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
      if (module.domain !== domain) {
        setDomain(module.domain);
      }
    },
    [domain, pathname, router, searchParams]
  );

  const handleDomainChange = (nextDomain: "PROCUREMENT" | "SALES") => {
    setDomain(nextDomain);
    const first = groups[nextDomain][0];
    if (first) selectModule(first);
  };

  const handleModuleChange = (moduleKey: DocumentModuleKey) => {
    const module = PRESENTATION_MODULE_DEFINITIONS.find((row) => row.moduleKey === moduleKey);
    if (module) selectModule(module);
  };

  return (
    <div className="document-templates-shell flex h-full min-h-0 w-full flex-col gap-3">
      <header className="shrink-0">
        <div className="flex items-center gap-2">
          <FileOutput className="h-6 w-6 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">Document print templates</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Design print and email PDF output — fields, appearance, and live preview. On-screen drawer
          layouts stay in module settings.
        </p>
      </header>

      {deployError ? (
        <div className="shrink-0 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
          {deployError}
        </div>
      ) : null}

      {!canEdit ? (
        <div className="shrink-0 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          You have read-only access. Organization owners or delegates can edit templates.
        </div>
      ) : null}

      {selectedModule ? (
        <>
          <DocumentTemplatesContextToolbar
            domain={domain}
            onDomainChange={handleDomainChange}
            modules={groups[domain]}
            selectedModuleKey={selectedModuleKey}
            onModuleChange={handleModuleChange}
            viewContext={viewContext}
            onViewContextChange={setViewContext}
            scope={scope}
            locations={locations}
            canEdit={canEdit}
            onScopeChange={setScope}
            designerTab={designerTab}
            onDesignerTabChange={setDesignerTab}
            fieldToolbarActions={fieldToolbarActions}
          />

          <div className="min-h-0 min-w-0 flex-1">
            <DocumentDesignerWorkspace
              key={selectedModule.moduleKey}
              moduleKey={selectedModule.moduleKey}
              moduleLabel={selectedModule.label}
              moduleDomain={selectedModule.domain}
              initialLayout={initialLayoutsByModule[selectedModule.moduleKey][viewContext]}
              initialLayoutsByViewContext={initialLayoutsByModule[selectedModule.moduleKey]}
              initialPresentationShells={initialPresentationShells[selectedModule.moduleKey]}
              initialPresentationStyles={initialPresentationStyles[selectedModule.moduleKey]}
              locations={locations}
              canEdit={canEdit}
              gstRegistered={gstRegistered}
              catalogFieldSuggestions={
                selectedModule.domain === "PROCUREMENT" ? catalogFieldSuggestions : undefined
              }
              viewContext={viewContext}
              scope={scope}
              designerTab={designerTab}
              onDesignerTabChange={setDesignerTab}
              onFieldToolbarActionsChange={setFieldToolbarActions}
              seededPreviewDraftKey={
                selectedModuleKey === previewModuleKey && viewContext === "PDF_PRINT"
                  ? initialPreviewDraftKey
                  : null
              }
              seededPreviewHtml={
                selectedModuleKey === previewModuleKey && viewContext === "PDF_PRINT"
                  ? initialPreviewHtml
                  : null
              }
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
