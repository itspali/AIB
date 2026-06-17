"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { loadPresentationTemplate } from "@/app/settings/documents/templates/actions";
import {
  DocumentLayoutScopeSelect,
  type DocumentLayoutLocationOption,
} from "@/components/settings/document-layout/document-layout-scope-select";
import {
  DocumentDesignerLivePreview,
} from "@/components/settings/document-templates/document-designer-live-preview";
import { DocumentModuleLayoutPanel } from "@/components/settings/document-templates/document-module-layout-panel";
import { PresentationTemplateEditor } from "@/components/settings/document-templates/presentation-template-editor";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { layoutScopeKey, TENANT_LAYOUT_SCOPE, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
import {
  applyDesignerLayoutPreset,
  cycleDesignerLayoutPreset,
  generateDesignerLayout,
  normalizeDesignerBundle,
  type DesignerLayoutBundle,
} from "@/lib/documents/print/document-designer-layout-presets";
import {
  applyGstShellConfigOverrides,
} from "@/lib/documents/print/gst-presentation-compliance";
import { DEFAULT_PRESENTATION_SHELL_CONFIG } from "@/lib/documents/print/default-shell-config";
import type {
  PresentationPageSize,
  PresentationShellConfig,
  PresentationViewContext,
} from "@/lib/documents/print/types";
import type { DocumentLayoutTemplate, DocumentModuleKey } from "@/lib/documents/types";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";
import { cn } from "@/lib/utils";

const GENERATED_PRESET_ID = "generated";

type ModulePresentationShells = Record<PresentationViewContext, PresentationShellConfig>;

type Props = {
  moduleKey: DocumentModuleKey;
  moduleLabel: string;
  moduleDomain: "PROCUREMENT" | "SALES";
  initialLayout: DocumentLayoutTemplate;
  initialPresentationShells: ModulePresentationShells;
  locations: DocumentLayoutLocationOption[];
  canEdit: boolean;
  gstRegistered: boolean;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
};

const OUTPUT_TABS: { id: PresentationViewContext; label: string }[] = [
  { id: "PDF_PRINT", label: "Print" },
  { id: "EMAIL_HTML", label: "Email PDF" },
];

function resolveShellConfig(
  moduleKey: DocumentModuleKey,
  viewContext: PresentationViewContext,
  shells: ModulePresentationShells,
  gstRegistered: boolean
): PresentationShellConfig {
  const base = shells[viewContext] ?? DEFAULT_PRESENTATION_SHELL_CONFIG;
  return applyGstShellConfigOverrides(moduleKey, base, gstRegistered);
}

export function DocumentDesignerWorkspace({
  moduleKey,
  moduleLabel,
  moduleDomain,
  initialLayout,
  initialPresentationShells,
  locations,
  canEdit,
  gstRegistered,
  catalogFieldSuggestions,
}: Props) {
  const [scope, setScope] = useState<DocumentLayoutScope>(TENANT_LAYOUT_SCOPE);
  const [viewContext, setViewContext] = useState<PresentationViewContext>("PDF_PRINT");
  const [designerTab, setDesignerTab] = useState<"fields" | "appearance">("fields");
  const [layout, setLayout] = useState<DocumentLayoutTemplate>(initialLayout);
  const [shellConfig, setShellConfig] = useState<PresentationShellConfig>(() =>
    resolveShellConfig(moduleKey, "PDF_PRINT", initialPresentationShells, gstRegistered)
  );
  const [shellLoadError, setShellLoadError] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState("standard");
  const [isGeneratedLayout, setIsGeneratedLayout] = useState(false);
  const [layoutSeedVersion, setLayoutSeedVersion] = useState(0);

  const baselineBundleRef = useRef<DesignerLayoutBundle | null>(null);
  const scopeKey = layoutScopeKey(scope);
  const panelKey = `${moduleKey}-${viewContext}-${scopeKey}`;

  useEffect(() => {
    setLayout(initialLayout);
    setActivePresetId("standard");
    setIsGeneratedLayout(false);
    setLayoutSeedVersion((value) => value + 1);
  }, [initialLayout, moduleKey]);

  useEffect(() => {
    if (scope.mode !== "tenant") return;
    setShellConfig(resolveShellConfig(moduleKey, viewContext, initialPresentationShells, gstRegistered));
    setShellLoadError(null);
  }, [moduleKey, viewContext, scopeKey, scope.mode, initialPresentationShells, gstRegistered]);

  useEffect(() => {
    if (scope.mode === "tenant") return;

    let cancelled = false;
    void loadPresentationTemplate({ moduleKey, viewContext, scope }).then((result) => {
      if (cancelled) return;
      if ("template" in result) {
        setShellLoadError(null);
        setShellConfig(
          applyGstShellConfigOverrides(moduleKey, result.template.shellConfig, gstRegistered)
        );
        return;
      }

      setShellLoadError(result.error);
      setShellConfig((current) =>
        current ?? resolveShellConfig(moduleKey, viewContext, initialPresentationShells, gstRegistered)
      );
      toast.error(result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [moduleKey, viewContext, scopeKey, gstRegistered, initialPresentationShells, scope]);

  useEffect(() => {
    baselineBundleRef.current = normalizeDesignerBundle(
      moduleKey,
      viewContext,
      initialLayout,
      shellConfig
    );
  }, [initialLayout, moduleKey, viewContext, shellConfig]);

  const applyBundle = useCallback((bundle: DesignerLayoutBundle) => {
    setLayout(bundle.layout);
    setShellConfig(bundle.shellConfig);
    setLayoutSeedVersion((value) => value + 1);
  }, []);

  const applyPresetById = useCallback(
    (presetId: string) => {
      if (presetId === GENERATED_PRESET_ID) {
        const baseline = baselineBundleRef.current;
        if (!baseline) return;
        const generated = generateDesignerLayout(baseline);
        applyBundle(generated);
        setIsGeneratedLayout(true);
        toast.success("Generated a new layout. Review and save to persist.");
        return;
      }
      const baseline = baselineBundleRef.current;
      if (!baseline) return;
      const applied = applyDesignerLayoutPreset(presetId, baseline);
      applyBundle(applied);
      setActivePresetId(presetId);
      setIsGeneratedLayout(false);
    },
    [applyBundle]
  );

  const handlePreviousPreset = useCallback(() => {
    const nextPreset = cycleDesignerLayoutPreset(activePresetId, -1);
    applyPresetById(nextPreset.id);
  }, [activePresetId, applyPresetById]);

  const handleNextPreset = useCallback(() => {
    const nextPreset = cycleDesignerLayoutPreset(activePresetId, 1);
    applyPresetById(nextPreset.id);
  }, [activePresetId, applyPresetById]);

  const handleAutoGenerate = useCallback(() => {
    applyPresetById(GENERATED_PRESET_ID);
  }, [applyPresetById]);

  const handlePageSizeChange = useCallback((size: PresentationPageSize) => {
    setShellConfig((current) =>
      current ? { ...current, page: { ...current.page, size } } : current
    );
  }, []);

  const screenLayoutHref = useMemo(
    () =>
      moduleDomain === "PROCUREMENT"
        ? `/settings/modules/procurement?tab=layout&layoutDoc=${layoutDocQuery(moduleKey)}`
        : `/settings/modules/sales?tab=layout&layoutDoc=${layoutDocQuery(moduleKey)}`,
    [moduleDomain, moduleKey]
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
      {shellLoadError ? (
        <div className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 lg:absolute lg:right-4 lg:top-4 lg:z-10 lg:max-w-sm">
          {shellLoadError}
        </div>
      ) : null}
      <aside className="flex w-full shrink-0 flex-col gap-2 lg:w-[min(100%,22rem)] lg:max-w-[22rem]">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-muted/20 px-2.5 py-2">
          <Tabs
            value={viewContext}
            onValueChange={(value) => setViewContext(value as PresentationViewContext)}
          >
            <TabsList className="h-7">
              {OUTPUT_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} className="h-6 px-2.5 text-xs">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <DocumentLayoutScopeSelect
            scope={scope}
            locations={locations}
            disabled={!canEdit}
            onScopeChange={setScope}
          />
        </div>

        <p className="px-0.5 text-[10px] text-muted-foreground">
          <Link href={screenLayoutHref} className="text-primary underline-offset-4 hover:underline">
            On-screen layout
          </Link>{" "}
          for {moduleLabel} is in module settings.
        </p>

        <Tabs
          value={designerTab}
          onValueChange={(value) => setDesignerTab(value as "fields" | "appearance")}
          className="min-h-0"
        >
          <TabsList className="h-7 w-full">
            <TabsTrigger value="fields" className="flex-1 text-xs">
              Fields
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex-1 text-xs">
              Appearance
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="fields"
            className={cn("mt-2 min-h-0", designerTab !== "fields" && "hidden")}
            forceMount
          >
            <DocumentModuleLayoutPanel
              key={`${panelKey}-${layoutSeedVersion}`}
              moduleKey={moduleKey}
              initialLayout={layout}
              locations={locations}
              canEdit={canEdit}
              gstRegistered={gstRegistered}
              catalogFieldSuggestions={catalogFieldSuggestions}
              scope={scope}
              viewContext={viewContext}
              onLayoutChange={setLayout}
            />
          </TabsContent>

          <TabsContent
            value="appearance"
            className={cn("mt-2 min-h-0", designerTab !== "appearance" && "hidden")}
            forceMount
          >
            <PresentationTemplateEditor
              key={`${panelKey}-appearance-${layoutSeedVersion}`}
              moduleKey={moduleKey}
              moduleLabel={moduleLabel}
              initialTemplates={[]}
              locations={locations}
              canEdit={canEdit}
              gstRegistered={gstRegistered}
              embedded
              controlledScope={scope}
              controlledViewContext={viewContext}
              shellConfigSeed={shellConfig}
              shellConfigSeedVersion={layoutSeedVersion}
              onShellConfigChange={setShellConfig}
            />
          </TabsContent>
        </Tabs>
      </aside>

      <DocumentDesignerLivePreview
        moduleKey={moduleKey}
        viewContext={viewContext}
        scope={scope}
        layout={layout}
        shellConfig={shellConfig}
        shellLoadError={shellLoadError}
        canEdit={canEdit}
        activePresetId={activePresetId}
        isGeneratedLayout={isGeneratedLayout}
        onSelectPreset={applyPresetById}
        onPreviousPreset={handlePreviousPreset}
        onNextPreset={handleNextPreset}
        onPageSizeChange={handlePageSizeChange}
        onAutoGenerate={handleAutoGenerate}
      />
    </div>
  );
}

function layoutDocQuery(moduleKey: DocumentModuleKey): string {
  switch (moduleKey) {
    case "PURCHASE_ORDER":
      return "po";
    case "GOODS_RECEIPT_NOTE":
      return "grn";
    case "PURCHASE_INVOICE":
      return "bill";
    case "SALES_QUOTATION":
      return "quote";
    case "SALES_ORDER":
      return "order";
    case "SALES_INVOICE":
      return "invoice";
    default:
      return "po";
  }
}
