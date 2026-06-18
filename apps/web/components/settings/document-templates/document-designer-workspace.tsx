"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { loadPresentationTemplate } from "@/app/settings/documents/templates/actions";
import type { DocumentLayoutLocationOption } from "@/components/settings/document-layout/document-layout-scope-select";
import type { DocumentLayoutEmbeddedToolbarActions } from "@/components/settings/document-layout/document-layout-panel";
import {
  DocumentDesignerPreviewPane,
} from "@/components/settings/document-templates/document-designer-preview-pane";
import { DocumentDesignerScreenPreviewPane } from "@/components/settings/document-templates/document-designer-screen-preview-pane";
import { DocumentModuleLayoutPanel } from "@/components/settings/document-templates/document-module-layout-panel";
import { PresentationTemplateEditor } from "@/components/settings/document-templates/presentation-template-editor";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { layoutScopeKey, type DocumentLayoutScope } from "@/lib/documents/layout-scope";
import {
  applyDesignerLayoutPreset,
  cycleDesignerLayoutPreset,
  generateDesignerLayout,
  normalizeDesignerBundle,
  presetIdFromStyleConfig,
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
import type { DocumentLayoutTemplate, DocumentModuleKey, DocumentViewContext } from "@/lib/documents/types";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";
import { cn } from "@/lib/utils";

const GENERATED_PRESET_ID = "generated";

type ModulePresentationShells = Record<PresentationViewContext, PresentationShellConfig>;
type ModulePresentationStyles = Record<PresentationViewContext, PresentationStyleConfig>;

type Props = {
  moduleKey: DocumentModuleKey;
  moduleLabel: string;
  initialLayout: DocumentLayoutTemplate;
  initialLayoutsByViewContext: Partial<Record<DocumentViewContext, DocumentLayoutTemplate>>;
  initialPresentationShells: ModulePresentationShells;
  initialPresentationStyles: ModulePresentationStyles;
  locations: DocumentLayoutLocationOption[];
  canEdit: boolean;
  gstRegistered: boolean;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
  viewContext: DocumentViewContext;
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

export function DocumentDesignerWorkspace({
  moduleKey,
  moduleLabel,
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
  const isScreenLayout = viewContext === "SCREEN_GRID";
  const presentationViewContext = isScreenLayout ? null : viewContext;
  const [layout, setLayout] = useState<DocumentLayoutTemplate>(() =>
    normalizeDesignerPreviewLayout(
      moduleKey,
      viewContext,
      initialLayoutsByViewContext[viewContext] ?? initialLayout,
      gstRegistered
    )
  );
  const [shellConfig, setShellConfig] = useState<PresentationShellConfig>(() =>
    presentationViewContext
      ? resolveShellConfig(moduleKey, presentationViewContext, initialPresentationShells, gstRegistered)
      : DEFAULT_PRESENTATION_SHELL_CONFIG
  );
  const [styleConfig, setStyleConfig] = useState<PresentationStyleConfig>(() =>
    presentationViewContext
      ? resolveStyleConfig(presentationViewContext, initialPresentationStyles)
      : DEFAULT_PRESENTATION_STYLE_CONFIG
  );
  const [shellLoadError, setShellLoadError] = useState<string | null>(null);
  const [activePresetId, setActivePresetId] = useState(() =>
    presentationViewContext
      ? presetIdFromStyleConfig(resolveStyleConfig(presentationViewContext, initialPresentationStyles))
      : "default"
  );
  const [previewPresetId, setPreviewPresetId] = useState(() =>
    presentationViewContext
      ? presetIdFromStyleConfig(resolveStyleConfig(presentationViewContext, initialPresentationStyles))
      : "default"
  );
  const [isGeneratedLayout, setIsGeneratedLayout] = useState(false);
  const [layoutSeedVersion, setLayoutSeedVersion] = useState(0);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const [shellConfigRevision, setShellConfigRevision] = useState(0);

  const presetBaselineRef = useRef<DesignerLayoutBundle | null>(null);
  const layoutDraftListenerRef = useRef<(layout: DocumentLayoutTemplate) => void>(() => {});
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
    if (presentationViewContext) {
      setShellConfig(
        resolveShellConfig(moduleKey, presentationViewContext, initialPresentationShells, gstRegistered)
      );
      setStyleConfig(resolveStyleConfig(presentationViewContext, initialPresentationStyles));
      setActivePresetId(
        presetIdFromStyleConfig(resolveStyleConfig(presentationViewContext, initialPresentationStyles))
      );
      setPreviewPresetId(
        presetIdFromStyleConfig(resolveStyleConfig(presentationViewContext, initialPresentationStyles))
      );
    }
    setIsGeneratedLayout(false);
    setLayoutRevision((value) => value + 1);
    setShellConfigRevision(0);
    setLayoutSeedVersion((value) => value + 1);
  }, [gstRegistered, initialLayout, initialLayoutsByViewContext, initialPresentationShells, initialPresentationStyles, moduleKey, viewContext]);

  useEffect(() => {
    if (isScreenLayout || scope.mode !== "tenant") return;
    const next = resolveShellConfig(moduleKey, viewContext as PresentationViewContext, initialPresentationShells, gstRegistered);
    setShellConfig((current) => (shellConfigsEqual(current, next) ? current : next));
    setStyleConfig(resolveStyleConfig(viewContext as PresentationViewContext, initialPresentationStyles));
    setShellLoadError(null);
  }, [isScreenLayout, moduleKey, viewContext, scopeKey, scope.mode, initialPresentationShells, initialPresentationStyles, gstRegistered]);

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
    if (isScreenLayout || scope.mode === "tenant") return;

    let cancelled = false;
    void loadPresentationTemplate({ moduleKey, viewContext: viewContext as PresentationViewContext, scope }).then((result) => {
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
        setActivePresetId(presetIdFromStyleConfig(result.template.styleConfig));
        setPreviewPresetId(presetIdFromStyleConfig(result.template.styleConfig));
        setIsGeneratedLayout(false);
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
  }, [buildPresetBaseline, gstRegistered, initialLayout, initialLayoutsByViewContext, isScreenLayout, moduleKey, viewContext, scopeKey, initialPresentationShells, scope]);

  useEffect(() => {
    if (isScreenLayout) return;
    const seed = initialLayoutsByViewContext[viewContext] ?? initialLayout;
    const nextLayout = normalizeDesignerPreviewLayout(moduleKey, viewContext, seed, gstRegistered);
    const nextShell = resolveShellConfig(moduleKey, viewContext as PresentationViewContext, initialPresentationShells, gstRegistered);
    const nextStyle = resolveStyleConfig(viewContext as PresentationViewContext, initialPresentationStyles);
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
    isScreenLayout,
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
        setPreviewPresetId(GENERATED_PRESET_ID);
        toast.success("Generated a new layout. Review and save to persist.");
        return;
      }
      const baseline = presetBaselineRef.current;
      if (!baseline) return;
      const applied = applyDesignerLayoutPreset(presetId, baseline);
      applyBundle(applied);
      setActivePresetId(presetId);
      setPreviewPresetId(presetId);
      setIsGeneratedLayout(false);
    },
    [applyBundle]
  );

  const handlePreviousPreset = useCallback(() => {
    const currentId = isGeneratedLayout ? GENERATED_PRESET_ID : previewPresetId;
    const nextPreset = cycleDesignerLayoutPreset(currentId, -1);
    setPreviewPresetId(nextPreset.id);
  }, [isGeneratedLayout, previewPresetId]);

  const handleNextPreset = useCallback(() => {
    const currentId = isGeneratedLayout ? GENERATED_PRESET_ID : previewPresetId;
    const nextPreset = cycleDesignerLayoutPreset(currentId, 1);
    setPreviewPresetId(nextPreset.id);
  }, [isGeneratedLayout, previewPresetId]);

  const handleAutoGenerate = useCallback(() => {
    applyPresetById(GENERATED_PRESET_ID);
  }, [applyPresetById]);

  const handlePageSizeChange = useCallback((size: PresentationPageSize) => {
    setShellConfig((current) =>
      current ? { ...current, page: { ...current.page, size } } : current
    );
  }, []);

  const handleLayoutChange = useCallback((next: DocumentLayoutTemplate) => {
    layoutDraftListenerRef.current(next);
  }, []);

  const handlePreviewPresetIdChange = useCallback((presetId: string) => {
    setPreviewPresetId(presetId);
  }, []);

  const handleShellConfigChange = useCallback((next: PresentationShellConfig) => {
    setShellConfig((current) => (current === next ? current : next));
  }, []);

  const handleStyleConfigChange = useCallback((next: PresentationStyleConfig) => {
    setStyleConfig(next);
    const nextPresetId = presetIdFromStyleConfig(next);
    setActivePresetId(nextPresetId);
    setPreviewPresetId(nextPresetId);
    setIsGeneratedLayout(false);
  }, []);

  const appliedPresetId = isGeneratedLayout ? GENERATED_PRESET_ID : activePresetId;

  const previewBundleOverride = useMemo(() => {
    if (previewPresetId === appliedPresetId) return null;
    const baseline = presetBaselineRef.current;
    if (!baseline) return null;
    if (previewPresetId === GENERATED_PRESET_ID) {
      return generateDesignerLayout(baseline);
    }
    return applyDesignerLayoutPreset(previewPresetId, baseline);
  }, [appliedPresetId, previewPresetId, layoutSeedVersion]);

  const handleApplyPreviewPreset = useCallback(() => {
    applyPresetById(previewPresetId);
  }, [applyPresetById, previewPresetId]);

  const handleFieldToolbarActionsChange = useCallback(
    (actions: DocumentLayoutEmbeddedToolbarActions | null) => {
      onFieldToolbarActionsChange?.(actions);
    },
    [onFieldToolbarActionsChange]
  );

  return (
    <div className="relative flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch">
      {shellLoadError ? (
        <div className="shrink-0 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100 lg:absolute lg:right-4 lg:top-4 lg:z-10 lg:max-w-sm">
          {shellLoadError}
        </div>
      ) : null}
      <aside className="flex w-full shrink-0 flex-col lg:w-[min(100%,22rem)] lg:max-w-[22rem]">
        <div className="min-w-0 w-full shrink-0 space-y-2 bg-white dark:bg-card">
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
            {!isScreenLayout ? (
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
              styleConfigSeed={styleConfig}
              onShellConfigChange={handleShellConfigChange}
              onStyleConfigChange={handleStyleConfigChange}
            />
            ) : null}
          </TabsContent>
          </Tabs>
        </div>
      </aside>

      {isScreenLayout ? (
        <DocumentDesignerScreenPreviewPane
          moduleKey={moduleKey}
          layoutDraftListenerRef={layoutDraftListenerRef}
          syncLayout={layout}
          syncLayoutRevision={layoutRevision}
        />
      ) : (
      <DocumentDesignerPreviewPane
        layoutDraftListenerRef={layoutDraftListenerRef}
        syncLayout={layout}
        syncLayoutRevision={layoutRevision}
        moduleKey={moduleKey}
        viewContext={viewContext as PresentationViewContext}
        scope={scope}
        shellConfig={shellConfig}
        styleConfig={styleConfig}
        shellLoadError={shellLoadError}
        canEdit={canEdit}
        appliedPresetId={appliedPresetId}
        previewPresetId={previewPresetId}
        previewBundleOverride={previewBundleOverride}
        isGeneratedLayout={isGeneratedLayout}
        activePresetId={activePresetId}
        onPreviewPresetIdChange={handlePreviewPresetIdChange}
        onSelectPreset={applyPresetById}
        onApplyPreviewPreset={handleApplyPreviewPreset}
        onPreviousPreset={handlePreviousPreset}
        onNextPreset={handleNextPreset}
        onPageSizeChange={handlePageSizeChange}
        onAutoGenerate={handleAutoGenerate}
        seededPreviewDraftKey={seededPreviewDraftKey}
        seededPreviewHtml={seededPreviewHtml}
      />
      )}
    </div>
  );
}
