"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FileOutput } from "lucide-react";
import {
  loadDocumentTemplateCatalogFieldSuggestions,
  loadDocumentTemplatesModuleBundle,
} from "@/app/settings/presentation/documents/actions";
import {
  DocumentTemplatesContextToolbar,
  type TemplateDesignerViewContext,
} from "@/components/settings/document-templates/document-templates-context-toolbar";
import type { DocumentLayoutLocationOption } from "@/components/settings/document-layout/document-layout-scope-select";
import type { DocumentLayoutEmbeddedToolbarActions } from "@/components/settings/document-layout/document-layout-panel";
import { SettingsGlassShell } from "@/components/settings/settings-glass-shell";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import { PRESENTATION_MODULE_DEFINITIONS } from "@/lib/documents/print/presentation-catalog";
import type { PresentationModuleDefinition } from "@/lib/documents/print/types";
import type {
  PresentationShellConfig,
  PresentationStyleConfig,
  PresentationViewContext,
} from "@/lib/documents/print/types";
import { TENANT_LAYOUT_SCOPE, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
import type { DocumentLayoutTemplate, DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";

type ModulePresentationShells = Record<PresentationViewContext, PresentationShellConfig>;
type ModulePresentationStyles = Record<PresentationViewContext, PresentationStyleConfig>;

const MODULE_QUERY = "module";

const DocumentDesignerWorkspace = dynamic(
  () =>
    import("@/components/settings/document-templates/document-designer-workspace").then(
      (module) => module.DocumentDesignerWorkspace
    ),
  { ssr: false, loading: () => <DocumentDesignerSkeleton /> }
);

function DocumentDesignerSkeleton() {
  return (
    <div
      className="flex h-full min-h-[480px] w-full flex-col gap-3 rounded-lg border border-border p-4"
      aria-busy="true"
      aria-label="Loading designer"
    >
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="min-h-0 flex-1" />
    </div>
  );
}

const VALID_MODULE_KEYS = new Set<DocumentModuleKey>(
  PRESENTATION_MODULE_DEFINITIONS.map((row) => row.moduleKey)
);

function parseModuleKey(raw: string | null): DocumentModuleKey | null {
  if (!raw || !VALID_MODULE_KEYS.has(raw as DocumentModuleKey)) return null;
  return raw as DocumentModuleKey;
}

export type DocumentTemplatesSettingsTerminalProps = {
  locations: DocumentLayoutLocationOption[];
  canEdit: boolean;
  gstRegistered: boolean;
  deployError?: string;
  initialModuleKey?: DocumentModuleKey | null;
  previewModuleKey: DocumentModuleKey;
  initialPreviewDraftKey: string;
  initialPreviewHtml: string | null;
  initialLayoutsByModule: Partial<
    Record<DocumentModuleKey, Record<DocumentViewContext, DocumentLayoutTemplate>>
  >;
  initialPresentationShells: Partial<Record<DocumentModuleKey, ModulePresentationShells>>;
  initialPresentationStyles: Partial<Record<DocumentModuleKey, ModulePresentationStyles>>;
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
}: DocumentTemplatesSettingsTerminalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryModule = parseModuleKey(searchParams.get(MODULE_QUERY));
  const [layoutsByModule, setLayoutsByModule] = useState(initialLayoutsByModule);
  const [presentationShellsByModule, setPresentationShellsByModule] =
    useState(initialPresentationShells);
  const [presentationStylesByModule, setPresentationStylesByModule] =
    useState(initialPresentationStyles);
  const [catalogSuggestions, setCatalogSuggestions] = useState(catalogFieldSuggestions);
  const [moduleLoading, setModuleLoading] = useState(false);
  const loadedModulesRef = useRef(
    new Set<DocumentModuleKey>(
      Object.keys(initialLayoutsByModule) as DocumentModuleKey[]
    )
  );
  const [viewContext, setViewContext] = useState<TemplateDesignerViewContext>("PDF_PRINT");
  const [scope, setScope] = useState<DocumentLayoutScope>(TENANT_LAYOUT_SCOPE);
  const [designerTab, setDesignerTab] = useState<"fields" | "appearance">("fields");
  const [fieldToolbarActions, setFieldToolbarActions] =
    useState<DocumentLayoutEmbeddedToolbarActions | null>(null);

  const selectedModuleKey = useMemo(() => {
    if (queryModule) return queryModule;
    if (initialModuleKey) return initialModuleKey;
    return "PURCHASE_ORDER";
  }, [queryModule, initialModuleKey]);

  const selectedModule = useMemo(
    () => PRESENTATION_MODULE_DEFINITIONS.find((row) => row.moduleKey === selectedModuleKey) ?? null,
    [selectedModuleKey]
  );

  const isScreenLayout = viewContext === "SCREEN_GRID";

  useEffect(() => {
    setScope(TENANT_LAYOUT_SCOPE);
    setDesignerTab("fields");
    setFieldToolbarActions(null);
  }, [selectedModuleKey]);

  useEffect(() => {
    if (loadedModulesRef.current.has(selectedModuleKey)) return;

    let cancelled = false;
    setModuleLoading(true);
    void loadDocumentTemplatesModuleBundle(selectedModuleKey).then((result) => {
      if (cancelled || "error" in result) return;
      loadedModulesRef.current.add(result.moduleKey);
      setLayoutsByModule((current) => ({
        ...current,
        [result.moduleKey]: result.layoutsByViewContext,
      }));
      setPresentationShellsByModule((current) => ({
        ...current,
        [result.moduleKey]: result.presentationShells,
      }));
      setPresentationStylesByModule((current) => ({
        ...current,
        [result.moduleKey]: result.presentationStyles,
      }));
    }).finally(() => {
      if (!cancelled) setModuleLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [selectedModuleKey]);

  useEffect(() => {
    const module = PRESENTATION_MODULE_DEFINITIONS.find(
      (row) => row.moduleKey === selectedModuleKey
    );
    if (module?.domain !== "PROCUREMENT" || catalogSuggestions) return;

    let cancelled = false;
    void loadDocumentTemplateCatalogFieldSuggestions().then((result) => {
      if (cancelled || "error" in result) return;
      setCatalogSuggestions(result.suggestions);
    });

    return () => {
      cancelled = true;
    };
  }, [catalogSuggestions, selectedModuleKey]);

  useEffect(() => {
    if (isScreenLayout) {
      setDesignerTab("fields");
    }
    setScope(TENANT_LAYOUT_SCOPE);
    setFieldToolbarActions(null);
  }, [isScreenLayout, viewContext]);

  const selectModule = useCallback(
    (module: PresentationModuleDefinition) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(MODULE_QUERY, module.moduleKey);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  const handleModuleChange = (moduleKey: DocumentModuleKey) => {
    const module = PRESENTATION_MODULE_DEFINITIONS.find((row) => row.moduleKey === moduleKey);
    if (module) selectModule(module);
  };

  const layoutsByViewContext = layoutsByModule[selectedModuleKey];
  const moduleBundleReady = Boolean(layoutsByViewContext);

  return (
    <div className="document-templates-shell flex h-full min-h-0 w-full flex-col gap-3">
      <header className="shrink-0">
        <div className="flex items-center gap-2">
          <FileOutput className="h-6 w-6 text-primary" aria-hidden />
          <h1 className="text-2xl font-bold tracking-tight">Document templates</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure on-screen drawer and peek layouts, plus print and email PDF output — fields,
          appearance, and live preview.
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
        <SettingsGlassShell className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <>
          <DocumentTemplatesContextToolbar
            modules={PRESENTATION_MODULE_DEFINITIONS}
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
            {moduleLoading || !moduleBundleReady ? (
              <DocumentDesignerSkeleton />
            ) : (
              <DocumentDesignerWorkspace
                key={`${selectedModule.moduleKey}-${viewContext}`}
                moduleKey={selectedModule.moduleKey}
                moduleLabel={selectedModule.label}
                initialLayout={layoutsByViewContext![viewContext]}
                initialLayoutsByViewContext={layoutsByViewContext!}
                initialPresentationShells={presentationShellsByModule[selectedModule.moduleKey]!}
                initialPresentationStyles={presentationStylesByModule[selectedModule.moduleKey]!}
                locations={locations}
                canEdit={canEdit}
                gstRegistered={gstRegistered}
                catalogFieldSuggestions={
                  selectedModule.domain === "PROCUREMENT" ? catalogSuggestions : undefined
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
            )}
          </div>
        </>
        </SettingsGlassShell>
      ) : null}
    </div>
  );
}
