"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { loadPresentationTemplate } from "@/app/settings/documents/templates/actions";
import type { DocumentLayoutLocationOption } from "@/components/settings/document-layout/document-layout-scope-select";
import type { DocumentLayoutEmbeddedToolbarActions } from "@/components/settings/document-layout/document-layout-panel";
import {
  DocumentDesignerLivePreview,
} from "@/components/settings/document-templates/document-designer-live-preview";
import { DocumentModuleLayoutPanel } from "@/components/settings/document-templates/document-module-layout-panel";
import { PresentationTemplateEditor } from "@/components/settings/document-templates/presentation-template-editor";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { layoutScopeKey, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
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
import { DEFAULT_PRESENTATION_SHELL_CONFIG, DEFAULT_PRESENTATION_STYLE_CONFIG } from "@/lib/documents/print/default-shell-config";
import { normalizeDesignerPreviewLayout } from "@/lib/documents/print/designer-preview-draft";
import type {
  PresentationPageSize,
  PresentationShellConfig,
  PresentationStyleConfig,
  PresentationViewContext,
} from "@/lib/documents/print/types";
import type { DocumentLayoutTemplate, DocumentModuleKey } from "@/lib/documents/types";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";
import { cn } from "@/lib/utils";

const GENERATED_PRESET_ID = "generated";

type ModulePresentationShells = Record<PresentationViewContext, PresentationShellConfig>;
type ModulePresentationStyles = Record<PresentationViewContext, PresentationStyleConfig>;

type Props = {
  moduleKey: DocumentModuleKey;
  moduleLabel: string;
  moduleDomain: "PROCUREMENT" | "SALES";
  initialLayout: DocumentLayoutTemplate;
  initialLayoutsByViewContext: Record<PresentationViewContext, DocumentLayoutTemplate>;
  initialPresentationShells: ModulePresentationShells;
  initialPresentationStyles: ModulePresentationStyles;
  locations: DocumentLayoutLocationOption[];
  canEdit: boolean;
  gstRegistered: boolean;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
  viewContext: PresentationViewContext;
  scope: DocumentLayoutScope;
  designerTab: "fields" | "appearance";
  onDesignerTabChange: (tab: "fields" | "appearance") => void;
  onFieldToolbarActionsChange?: (actions: DocumentLayoutEmbeddedToolbarActions | null) => void;
  seededPreviewDraftKey?: string | null;
  seededPreviewHtml?: string | null;
};

function resolveShellConfig(
  moduleKey: DocumentModuleKey,
  viewContext: PresentationViewContext,
  shells: ModulePresentationShells,
  gstRegistered: boolean
): PresentationShellConfig {
  const base = shells[viewContext] ?? DEFAULT_PRESENTATION_SHELL_CONFIG;
  return applyGstShellConfigOverrides(moduleKey, base, gstRegistered);
}

function resolveStyleConfig(
  viewContext: PresentationViewContext,
  styles: ModulePresentationStyles
): PresentationStyleConfig {
  return styles[viewContext] ?? DEFAULT_PRESENTATION_STYLE_CONFIG;
}

function shellConfigsEqual(
  left: PresentationShellConfig,
  right: PresentationShellConfig
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function layoutsEqual(left: DocumentLayoutTemplate, right: DocumentLayoutTemplate): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function DocumentDesignerWorkspace({
  moduleKey,
  moduleLabel,
  moduleDomain,
  initialLayout,
  initialLayoutsByViewContext,
  initialPresentationShells,
  initialPresentationStyles,
  locations,
  canEdit,
  gstRegistered,
  catalogFieldSuggestions,
  viewContext,
  scope,
  designerTab,
  onDesignerTabChange,
  onFieldToolbarActionsChange,
  seededPreviewDraftKey = null,
  seededPreviewHtml = null,
}: Props) {
  const [layout, setLayout] = useState<DocumentLayoutTemplate>(() =>
    normalizeDesignerPreviewLayout(
      moduleKey,
      viewContext,
      initialLayoutsByViewContext[viewContext] ?? initialLayout,
      gstRegistered
    )
  );
  const [shellConfig, setShellConfig] = useState<PresentationShellConfig>(() =>
    resolveShellConfig(moduleKey, viewContext, initialPresentationShells, gstRegistered)
  );
  const [styleConfig, setStyleConfig] = useState<PresentationStyleConfig>(() =>
    resolveStyleConfig(viewContext, initialPresentationStyles)
  );
  const [shellLoadError, setShellLoadError] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState("standard");
  const [isGeneratedLayout, setIsGeneratedLayout] = useState(false);
  const [layoutSeedVersion, setLayoutSeedVersion] = useState(0);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [shellConfigRevision, setShellConfigRevision] = useState(0);

  const presetBaselineRef = useRef<DesignerLayoutBundle | null>(null);
  const scopeKey = layoutScopeKey(scope);
  const panelKey = `${moduleKey}-${viewContext}-${scopeKey}`;
  const contextRef = useRef({ moduleKey, viewContext });

  useEffect(() => {
    const contextChanged =
      contextRef.current.moduleKey !== moduleKey ||
      contextRef.current.viewContext !== viewContext;
    if (!contextChanged) return;

    contextRef.current = { moduleKey, viewContext };
    const seed = initialLayoutsByViewContext[viewContext];
    setLayout(
      normalizeDesignerPreviewLayout(moduleKey, viewContext, seed ?? initialLayout, gstRegistered)
    );
    setShellConfig(
      resolveShellConfig(moduleKey, viewContext, initialPresentationShells, gstRegistered)
    );
    setStyleConfig(resolveStyleConfig(viewContext, initialPresentationStyles));
    setActivePresetId("standard");
    setIsGeneratedLayout(false);
    setLayoutRevision((value) => value + 1);
    setShellConfigRevision(0);
    setLayoutSeedVersion((value) => value + 1);
  }, [gstRegistered, initialLayout, initialLayoutsByViewContext, initialPresentationShells, initialPresentationStyles, moduleKey, viewContext]);

  useEffect(() => {
    if (scope.mode !== "tenant") return;
    const next = resolveShellConfig(moduleKey, viewContext, initialPresentationShells, gstRegistered);
    setShellConfig((current) => (shellConfigsEqual(current, next) ? current : next));
    setStyleConfig(resolveStyleConfig(viewContext, initialPresentationStyles));
    setShellLoadError(null);
  }, [moduleKey, viewContext, scopeKey, scope.mode, initialPresentationShells, initialPresentationStyles, gstRegistered]);

  const buildPresetBaseline = useCallback(
    (
      nextLayout: DocumentLayoutTemplate,
      nextShell: PresentationShellConfig,
      nextStyle: PresentationStyleConfig
    ) =>
      normalizeDesignerBundle(moduleKey, viewContext, nextLayout, nextShell, nextStyle),
    [moduleKey, viewContext]
  );

  useEffect(() => {
    if (scope.mode === "tenant") return;

    let cancelled = false;
    void loadPresentationTemplate({ moduleKey, viewContext, scope }).then((result) => {
      if (cancelled) return;
      if ("template" in result) {
        setShellLoadError(null);
        const nextShell = applyGstShellConfigOverrides(
          moduleKey,
          result.template.shellConfig,
          gstRegistered
        );
        setShellConfig(nextShell);
        setStyleConfig(result.template.styleConfig);
        const seed = initialLayoutsByViewContext[viewContext] ?? initialLayout;
        presetBaselineRef.current = buildPresetBaseline(
          normalizeDesignerPreviewLayout(moduleKey, viewContext, seed, gstRegistered),
          nextShell,
          result.template.styleConfig
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
  }, [buildPresetBaseline, gstRegistered, initialLayout, initialLayoutsByViewContext, moduleKey, viewContext, scopeKey, initialPresentationShells, scope]);

  useEffect(() => {
    const seed = initialLayoutsByViewContext[viewContext] ?? initialLayout;
    const nextLayout = normalizeDesignerPreviewLayout(moduleKey, viewContext, seed, gstRegistered);
    const nextShell = resolveShellConfig(moduleKey, viewContext, initialPresentationShells, gstRegistered);
    const nextStyle = resolveStyleConfig(viewContext, initialPresentationStyles);
    presetBaselineRef.current = buildPresetBaseline(nextLayout, nextShell, nextStyle);
  }, [
    buildPresetBaseline,
    gstRegistered,
    initialLayout,
    initialLayoutsByViewContext,
    initialPresentationShells,
    initialPresentationStyles,
    layoutSeedVersion,
    moduleKey,
    scopeKey,
    viewContext,
  ]);

  const applyBundle = useCallback((bundle: DesignerLayoutBundle) => {
    setLayout(bundle.layout);
    setShellConfig(bundle.shellConfig);
    setStyleConfig(bundle.styleConfig);
    setLayoutRevision((value) => value + 1);
    setShellConfigRevision((value) => value + 1);
  }, []);

  const applyPresetById = useCallback(
    (presetId: string) => {
      if (presetId === GENERATED_PRESET_ID) {
        const baseline = presetBaselineRef.current;
        if (!baseline) return;
        const generated = generateDesignerLayout(baseline);
        applyBundle(generated);
        setIsGeneratedLayout(true);
        toast.success("Generated a new layout. Review and save to persist.");
        return;
      }
      const baseline = presetBaselineRef.current;
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

  const handleLayoutChange = useCallback((next: DocumentLayoutTemplate) => {
    setLayout((current) => (layoutsEqual(current, next) ? current : next));
  }, []);

  const handleShellConfigChange = useCallback((next: PresentationShellConfig) => {
    setShellConfig((current) => (current === next ? current : next));
  }, []);

  const handleFieldToolbarActionsChange = useCallback(
    (actions: DocumentLayoutEmbeddedToolbarActions | null) => {
      onFieldToolbarActionsChange?.(actions);
    },
    [onFieldToolbarActionsChange]
  );

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
      <aside className="flex w-full shrink-0 flex-col lg:w-[min(100%,22rem)] lg:max-w-[22rem]">
        <div className="shrink-0 space-y-2 rounded-md border border-border/60 bg-muted/20 p-2">
          <p className="text-[10px] leading-snug text-muted-foreground">
            <Link href={screenLayoutHref} className="text-primary underline-offset-4 hover:underline">
              Screen layout
            </Link>
            <span className="text-muted-foreground/75"> · module settings</span>
          </p>

          <Tabs
            value={designerTab}
            onValueChange={(value) => onDesignerTabChange(value as "fields" | "appearance")}
            className="min-h-0"
          >
          <TabsContent
            value="fields"
            className={cn("mt-1.5 min-h-0", designerTab !== "fields" && "hidden")}
            forceMount
          >
            <DocumentModuleLayoutPanel
              key={`${panelKey}-${layoutSeedVersion}`}
              moduleKey={moduleKey}
              initialLayout={initialLayout}
              locations={locations}
              canEdit={canEdit}
              gstRegistered={gstRegistered}
              catalogFieldSuggestions={catalogFieldSuggestions}
              scope={scope}
              viewContext={viewContext}
              layoutSeeds={initialLayoutsByViewContext}
              controlledLayout={layout}
              controlledLayoutVersion={layoutRevision}
              onLayoutChange={handleLayoutChange}
              onEmbeddedToolbarActionsChange={handleFieldToolbarActionsChange}
            />
          </TabsContent>

          <TabsContent
            value="appearance"
            className={cn("mt-1.5 min-h-0", designerTab !== "appearance" && "hidden")}
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
              shellConfigSeedVersion={shellConfigRevision}
              onShellConfigChange={handleShellConfigChange}
            />
          </TabsContent>
          </Tabs>
        </div>
      </aside>

      <DocumentDesignerLivePreview
        moduleKey={moduleKey}
        viewContext={viewContext}
        scope={scope}
        layout={layout}
        shellConfig={shellConfig}
        styleConfig={styleConfig}
        shellLoadError={shellLoadError}
        canEdit={canEdit}
        activePresetId={activePresetId}
        isGeneratedLayout={isGeneratedLayout}
        onSelectPreset={applyPresetById}
        onPreviousPreset={handlePreviousPreset}
        onNextPreset={handleNextPreset}
        onPageSizeChange={handlePageSizeChange}
        onAutoGenerate={handleAutoGenerate}
        seededPreviewDraftKey={seededPreviewDraftKey}
        seededPreviewHtml={seededPreviewHtml}
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
