"use client";

import { useEffect, useMemo, useRef, useState, useTransition, useCallback } from "react";
import { toast } from "sonner";
import { DocumentLayoutCatalogFieldsSection } from "@/components/settings/document-layout/document-layout-catalog-fields-section";
import { DocumentLayoutFieldList } from "@/components/settings/document-layout/document-layout-field-list";
import { DocumentLayoutPreview } from "@/components/settings/document-layout/document-layout-preview";
import { DocumentLayoutSimplePreview } from "@/components/settings/document-layout/document-layout-simple-preview";
import {
  DocumentLayoutScopeSelect,
  type DocumentLayoutLocationOption,
} from "@/components/settings/document-layout/document-layout-scope-select";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  layoutScopeKey,
  TENANT_LAYOUT_SCOPE,
  type DocumentLayoutScope,
} from "@/lib/documents/layout-scope";
import type { DocumentLayoutModuleAdapter } from "@/lib/documents/document-layout-module-adapters";
import {
  applyGstRegisteredDocumentLayoutOverrides,
  HSN_CATALOG_FIELD_ID,
} from "@/lib/documents/gst-document-layout-compliance";
import type { DocumentImageDisplayMode, DocumentLayoutTemplate, DocumentViewContext } from "@/lib/documents/types";
import { DOCUMENT_LAYOUT_PRINT_EMAIL_ENABLED } from "@/lib/documents/types";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";
import {
  clearPoScreenLayoutLocalOverrides,
  hasPoScreenLayoutLocalOverrides,
} from "@/lib/documents/po-layout-local-overrides";
import { cn } from "@/lib/utils";

type LoadLayoutFn = (input: {
  viewContext: DocumentViewContext;
  scope?: DocumentLayoutScope;
}) => Promise<{ layout: DocumentLayoutTemplate } | { error: string }>;

type SaveLayoutFn = (input: {
  scope: DocumentLayoutScope;
  viewContext: DocumentViewContext;
  layout: DocumentLayoutTemplate;
}) => Promise<{ success: true } | { error: string }>;

export type DocumentLayoutEmbeddedToolbarActions = {
  onReset: () => void;
  onSave: () => void;
  disabled: boolean;
  saveLabel: string;
};

type Props = {
  adapter: DocumentLayoutModuleAdapter;
  initialLayout: DocumentLayoutTemplate;
  locations?: DocumentLayoutLocationOption[];
  canEdit?: boolean;
  gstRegistered?: boolean;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
  loadLayout: LoadLayoutFn;
  saveLayout: SaveLayoutFn;
  /** When true, only Print/Email contexts and no side preview (document designer). */
  embedded?: boolean;
  compactFieldToolbar?: boolean;
  controlledScope?: DocumentLayoutScope;
  controlledViewContext?: DocumentViewContext;
  controlledLayout?: DocumentLayoutTemplate;
  controlledLayoutVersion?: number;
  onLayoutChange?: (layout: DocumentLayoutTemplate) => void;
  onEmbeddedToolbarActionsChange?: (actions: DocumentLayoutEmbeddedToolbarActions | null) => void;
  /** After layout save succeeds (embedded designer: also persist appearance). */
  afterSaveLayout?: () => Promise<{ error?: string } | void>;
  hideChromeToolbar?: boolean;
  /** Hide On-screen / Print / Email tabs when the parent toolbar owns view context. */
  hideViewContextTabs?: boolean;
  layoutSeeds?: Partial<Record<DocumentViewContext, DocumentLayoutTemplate>>;
};

const VIEW_TABS: { id: DocumentViewContext; label: string; enabled: boolean }[] = [
  { id: "SCREEN_GRID", label: "On-screen", enabled: true },
  { id: "PDF_PRINT", label: "Print", enabled: DOCUMENT_LAYOUT_PRINT_EMAIL_ENABLED },
  { id: "EMAIL_HTML", label: "Email", enabled: DOCUMENT_LAYOUT_PRINT_EMAIL_ENABLED },
];

function hasDecimalPlaces(columnId: string): boolean {
  return !["is_qc_pending", "match_status", "tax_treatment", "port_code"].includes(columnId);
}

function SectionBlock({
  title,
  hint,
  children,
  className,
  accordionValue,
  embeddedSection = false,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  accordionValue?: string;
  embeddedSection?: boolean;
}) {
  if (accordionValue) {
    return (
      <AccordionItem
        value={accordionValue}
        className={cn(
          embeddedSection ? "border-b border-border" : "border-border/70",
          className
        )}
      >
        <AccordionTrigger
          className={cn(
            "gap-2 hover:no-underline [&>svg]:text-muted-foreground",
            embeddedSection
              ? "px-1.5 py-3 [&>svg]:h-4 [&>svg]:w-4"
              : "py-2 [&>svg]:h-3.5 [&>svg]:w-3.5"
          )}
        >
          <span className="flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left">
            <span
              className={cn(
                embeddedSection
                  ? "text-xs font-bold uppercase tracking-wide text-foreground"
                  : "text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              )}
            >
              {title}
            </span>
            {hint ? (
              <span
                className={cn(
                  "font-normal normal-case tracking-normal line-clamp-2",
                  embeddedSection
                    ? "text-[11px] text-muted-foreground"
                    : "text-[10px] text-muted-foreground/75"
                )}
              >
                {hint}
              </span>
            ) : null}
          </span>
        </AccordionTrigger>
        <AccordionContent
          className={cn("pt-0", embeddedSection ? "px-1.5 pb-3" : "pb-2")}
        >
          {children}
        </AccordionContent>
      </AccordionItem>
    );
  }

  return (
    <section className={cn("min-w-0", className)}>
      <div className="mb-1 flex items-baseline gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        {hint ? <span className="text-[10px] text-muted-foreground/80">{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function LayoutFieldSections({
  embedded,
  children,
}: {
  embedded: boolean;
  children: React.ReactNode;
}) {
  if (!embedded) {
    return <div className="space-y-3">{children}</div>;
  }

  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="header"
      className="w-full border-t border-border"
    >
      {children}
    </Accordion>
  );
}

export function DocumentLayoutPanel({
  adapter,
  initialLayout,
  locations = [],
  canEdit = true,
  gstRegistered = false,
  catalogFieldSuggestions,
  loadLayout,
  saveLayout,
  embedded = false,
  compactFieldToolbar = false,
  controlledScope,
  controlledViewContext,
  controlledLayout,
  controlledLayoutVersion,
  onLayoutChange,
  onEmbeddedToolbarActionsChange,
  afterSaveLayout,
  hideChromeToolbar = false,
  hideViewContextTabs = false,
  layoutSeeds,
}: Props) {
  const applyGstCompliance = (template: DocumentLayoutTemplate) => {
    const normalized = adapter.normalize(template);
    return gstRegistered
      ? applyGstRegisteredDocumentLayoutOverrides(normalized, true, adapter.catalog.createPref)
      : normalized;
  };

  const [scope, setScope] = useState<DocumentLayoutScope>(controlledScope ?? TENANT_LAYOUT_SCOPE);
  const [viewContext, setViewContext] = useState<DocumentViewContext>(
    controlledViewContext ?? (embedded ? "PDF_PRINT" : initialLayout.viewContext ?? "SCREEN_GRID")
  );
  const [layout, setLayout] = useState<DocumentLayoutTemplate>(() => applyGstCompliance(initialLayout));
  const notifyParentOnLayoutCommit = useRef(false);
  const updateLayout = (
    updater: DocumentLayoutTemplate | ((current: DocumentLayoutTemplate) => DocumentLayoutTemplate),
    options?: { syncParent?: boolean }
  ) => {
    notifyParentOnLayoutCommit.current = options?.syncParent !== false && onLayoutChange != null;
    setLayout((current) => (typeof updater === "function" ? updater(current) : updater));
  };

  useEffect(() => {
    if (!notifyParentOnLayoutCommit.current) return;
    notifyParentOnLayoutCommit.current = false;
    onLayoutChange?.(layout);
  }, [layout, onLayoutChange]);

  useEffect(() => {
    if (!controlledScope) return;
    setScope((current) =>
      layoutScopeKey(current) === layoutScopeKey(controlledScope) ? current : controlledScope
    );
  }, [controlledScope]);

  useEffect(() => {
    if (!controlledViewContext) return;
    setViewContext((current) => (current === controlledViewContext ? current : controlledViewContext));
  }, [controlledViewContext]);
  const [previewMode, setPreviewMode] = useState<"drawer" | "peek">("drawer");
  const [isPending, startTransition] = useTransition();
  const [isLoadingLayout, setIsLoadingLayout] = useState(false);
  const hydratedScopeKey = useRef(layoutScopeKey(TENANT_LAYOUT_SCOPE));
  const hydratedViewContext = useRef<DocumentViewContext>(
    initialLayout.viewContext ?? "SCREEN_GRID"
  );
  const hydrationSignatureRef = useRef<string | null>(null);
  const appliedControlledLayoutVersionRef = useRef<number | null>(null);

  useEffect(() => {
    if (!embedded || !controlledLayout || controlledLayoutVersion == null) return;
    if (appliedControlledLayoutVersionRef.current === controlledLayoutVersion) return;
    appliedControlledLayoutVersionRef.current = controlledLayoutVersion;
    updateLayout(applyGstCompliance(controlledLayout), { syncParent: false });
  }, [embedded, controlledLayout, controlledLayoutVersion]);

  useEffect(() => {
    const scopeKey = layoutScopeKey(scope);
    const signature = `${scopeKey}:${viewContext}`;
    const seededLayout = scope.mode === "tenant" ? layoutSeeds?.[viewContext] : undefined;

    if (seededLayout) {
      if (hydrationSignatureRef.current !== signature) {
        hydrationSignatureRef.current = signature;
        hydratedScopeKey.current = scopeKey;
        hydratedViewContext.current = viewContext;
        updateLayout(applyGstCompliance({ ...seededLayout, viewContext }), { syncParent: false });
      }
      return;
    }

    if (embedded && layoutSeeds && scope.mode === "tenant") {
      return;
    }

    const isInitialHydration =
      scopeKey === hydratedScopeKey.current &&
      viewContext === hydratedViewContext.current &&
      viewContext === (initialLayout.viewContext ?? "SCREEN_GRID");

    if (isInitialHydration) {
      const next = applyGstCompliance(initialLayout);
      updateLayout(next, { syncParent: false });
      return;
    }

    let cancelled = false;
    setIsLoadingLayout(true);
    void loadLayout({ viewContext, scope }).then((result) => {
      if (cancelled) return;
      setIsLoadingLayout(false);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to load document layout.");
        return;
      }
      hydrationSignatureRef.current = signature;
      hydratedScopeKey.current = scopeKey;
      hydratedViewContext.current = viewContext;
      updateLayout(applyGstCompliance(result.layout));
    });

    return () => {
      cancelled = true;
      setIsLoadingLayout(false);
    };
  }, [adapter, scope, viewContext, loadLayout, layoutSeeds]);

  const gstRegisteredRef = useRef(gstRegistered);

  useEffect(() => {
    if (gstRegisteredRef.current === gstRegistered) return;
    gstRegisteredRef.current = gstRegistered;
    updateLayout((current) => applyGstCompliance(current));
  }, [gstRegistered]);

  const columnById = useMemo(() => new Map(layout.columns.map((column) => [column.id, column])), [layout.columns]);

  const getColumn = (id: string) => columnById.get(id);

  const patchColumn = (id: string, patch: Partial<(typeof layout.columns)[number]>) => {
    if (
      gstRegistered &&
      id === HSN_CATALOG_FIELD_ID &&
      patch.defaultVisible === false
    ) {
      return;
    }
    updateLayout((current) => adapter.patchColumn(current, id, patch));
  };

  const handleReset = useCallback(() => {
    updateLayout(
      applyGstCompliance({
        ...adapter.defaultLayout,
        viewContext,
      })
    );
    toast.message("Layout reset to defaults.");
  }, [adapter.defaultLayout, applyGstCompliance, updateLayout, viewContext]);

  const handleResetLocalOverrides = () => {
    if (adapter.moduleKey !== "PURCHASE_ORDER") return;
    clearPoScreenLayoutLocalOverrides();
    toast.success("Your on-screen layout overrides were cleared.");
  };

  const hasLocalOverrides =
    adapter.moduleKey === "PURCHASE_ORDER" && hasPoScreenLayoutLocalOverrides();

  const handleSave = useCallback(() => {
    startTransition(async () => {
      const compliantLayout = applyGstCompliance({
        ...layout,
        viewContext,
        moduleKey: adapter.moduleKey,
      });

      const result = await saveLayout({
        scope,
        viewContext,
        layout: compliantLayout,
      });

      if ("error" in result) {
        toast.error(result.error ?? "Unable to save document layout.");
        return;
      }

      hydratedViewContext.current = viewContext;

      if (afterSaveLayout) {
        const companionResult = await afterSaveLayout();
        if (companionResult && "error" in companionResult && companionResult.error) {
          toast.error(companionResult.error);
          return;
        }
        toast.success("Document template saved.");
        return;
      }

      toast.success("Document layout saved.");
    });
  }, [adapter.moduleKey, afterSaveLayout, applyGstCompliance, layout, saveLayout, scope, viewContext]);

  const controlsDisabled = !canEdit || isPending || isLoadingLayout;
  const saveLabel = isPending ? "Saving…" : isLoadingLayout ? "Loading…" : "Save";
  const useExternalToolbar = embedded && hideChromeToolbar && onEmbeddedToolbarActionsChange != null;
  const toolbarActionsRef = useRef({ onReset: handleReset, onSave: handleSave });
  toolbarActionsRef.current = { onReset: handleReset, onSave: handleSave };

  useEffect(() => {
    if (!useExternalToolbar || !onEmbeddedToolbarActionsChange) return;

    onEmbeddedToolbarActionsChange({
      onReset: () => toolbarActionsRef.current.onReset(),
      onSave: () => toolbarActionsRef.current.onSave(),
      disabled: controlsDisabled,
      saveLabel,
    });

    return () => onEmbeddedToolbarActionsChange(null);
  }, [useExternalToolbar, onEmbeddedToolbarActionsChange, controlsDisabled, saveLabel]);

  const lineOrder = adapter.getLineSettingsColumnOrder(layout);
  const headerOrder = layout.headerFieldOrder;
  const totalsOrder = layout.totalsFieldOrder.filter(
    (id) => !adapter.totalsInternalFieldIds.includes(id)
  );

  const visibleViewTabs = VIEW_TABS.filter((tab) => {
    if (hideViewContextTabs) return false;
    return embedded ? tab.id !== "SCREEN_GRID" && tab.enabled : tab.enabled;
  });

  return (
    <div className={cn(embedded ? "space-y-2" : "space-y-3")}>
      {!hideChromeToolbar ? (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <DocumentLayoutScopeSelect
            scope={scope}
            locations={locations}
            disabled={!canEdit || controlledScope != null}
            onScopeChange={setScope}
          />
          {visibleViewTabs.length > 0 ? (
            <Tabs
              value={viewContext}
              onValueChange={(value) => setViewContext(value as DocumentViewContext)}
            >
              <TabsList className="h-7">
                {visibleViewTabs.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id} disabled={!tab.enabled || (controlledViewContext != null && tab.id !== controlledViewContext)} className="h-6 px-2 text-xs">
                    {tab.label}
                    {!tab.enabled ? "*" : null}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          {!embedded && viewContext === "SCREEN_GRID" && hasLocalOverrides ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={controlsDisabled}
              onClick={handleResetLocalOverrides}
            >
              Reset my screen overrides
            </Button>
          ) : null}
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={controlsDisabled} onClick={handleReset}>
            Reset
          </Button>
          <Button type="button" size="sm" className="h-7 px-3 text-xs" disabled={controlsDisabled} onClick={handleSave}>
            {isPending ? "Saving…" : isLoadingLayout ? "Loading…" : "Save fields"}
          </Button>
        </div>
      </div>
      ) : useExternalToolbar ? null : (
        <div className="flex justify-end gap-1.5">
          <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={controlsDisabled} onClick={handleReset}>
            Reset fields
          </Button>
          <Button type="button" size="sm" className="h-7 px-3 text-xs" disabled={controlsDisabled} onClick={handleSave}>
            {saveLabel}
          </Button>
        </div>
      )}

      <div className={cn("grid gap-3", embedded ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]")}>
        <div
          className={cn(
            "min-w-0 w-full",
            embedded ? "bg-white dark:bg-card" : "rounded-md border border-border bg-card p-2 sm:p-2.5"
          )}
        >
          <LayoutFieldSections embedded={embedded}>
          <SectionBlock
            title="Header"
            hint="Header · top row · Details · side panel"
            accordionValue={embedded ? "header" : undefined}
            embeddedSection={embedded}
          >
            <DocumentLayoutFieldList
              order={headerOrder}
              getColumn={(id) => getColumn(id)}
              showHeaderPlacementColumns
              showTypographyColumns={!compactFieldToolbar}
              compactToolbar={compactFieldToolbar}
              flush={embedded}
              getMeta={(id) => ({
                showHeaderPlacement: adapter.isFormHeaderPlaceableField(id),
              })}
              onPatch={patchColumn}
              onMove={(fromId, toId) =>
                updateLayout((current) => adapter.moveHeaderFieldOrder(current, fromId, toId))
              }
            />
          </SectionBlock>

          <SectionBlock
            title="Lines"
            hint="Column · Detail"
            accordionValue={embedded ? "lines" : undefined}
            embeddedSection={embedded}
          >
            <DocumentLayoutFieldList
              order={lineOrder}
              getColumn={(id) => getColumn(id)}
              showPresentationColumns
              showAlignColumn
              showDecimalsColumn
              showTypographyColumns={!compactFieldToolbar}
              compactToolbar={compactFieldToolbar}
              flush={embedded}
              getMeta={(id) => ({
                pinned: id === "item",
                draggable: id !== "item",
                lockLineSlot: id === "item" ? "column" : undefined,
                showAlign: true,
                showDecimalPlaces: hasDecimalPlaces(id),
              })}
              onPatch={patchColumn}
              onMove={(fromId, toId) =>
                updateLayout((current) => adapter.moveLineColumnOrder(current, fromId, toId))
              }
            />
          </SectionBlock>

          {adapter.showCatalogSection ? (
            <SectionBlock
              title="Catalog fields"
              hint={
                gstRegistered
                  ? "HSN/SAC required · read-only · from item master · under item cell"
                  : "Read-only · from item master · under item cell"
              }
              accordionValue={embedded ? "catalog" : undefined}
              embeddedSection={embedded}
            >
              <DocumentLayoutCatalogFieldsSection
                layout={layout}
                canEdit={!controlsDisabled}
                gstRegistered={gstRegistered}
                catalogAdapter={adapter.catalog}
                customFieldKeys={catalogFieldSuggestions?.customFieldKeys}
                variantAttributeKeys={catalogFieldSuggestions?.variantAttributeKeys}
                compactToolbar={compactFieldToolbar}
                flush={embedded}
                onLayoutChange={(next) => updateLayout(next)}
              />
            </SectionBlock>
          ) : null}

          {adapter.showTotalsSection ? (
            <SectionBlock title="Totals" accordionValue={embedded ? "totals" : undefined} embeddedSection={embedded}>
              <DocumentLayoutFieldList
                order={totalsOrder}
                getColumn={(id) => getColumn(id)}
                showAlignColumn
                showDecimalsColumn
                showTypographyColumns={!compactFieldToolbar}
                compactToolbar={compactFieldToolbar}
                flush={embedded}
                getMeta={(id) => ({
                  showAlign: true,
                  showDecimalPlaces: hasDecimalPlaces(id),
                })}
                onPatch={patchColumn}
                onMove={(fromId, toId) =>
                  adapter.moveTotalsFieldOrder
                    ? updateLayout((current) => adapter.moveTotalsFieldOrder!(current, fromId, toId))
                    : undefined
                }
              />
            </SectionBlock>
          ) : null}

          {adapter.showImageSection ? (
            <SectionBlock
              title="Line images"
              hint={embedded ? "Print layout" : "On-screen drawer · print"}
              accordionValue={embedded ? "images" : undefined}
              embeddedSection={embedded}
            >
              <Select
                value={layout.imageDisplayMode}
                disabled={controlsDisabled}
                onValueChange={(value) =>
                  updateLayout((current) => ({
                    ...current,
                    imageDisplayMode: value as DocumentImageDisplayMode,
                  }))
                }
              >
                <SelectTrigger className="h-7 w-full max-w-[16rem] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="INLINE_CELL">Inline with item</SelectItem>
                  <SelectItem value="SEPARATE_COLUMN">Separate column</SelectItem>
                  <SelectItem value="HIDDEN">Hidden</SelectItem>
                </SelectContent>
              </Select>
            </SectionBlock>
          ) : null}
          </LayoutFieldSections>
        </div>

        {!embedded ? (
        <aside className="min-w-0 rounded-md border border-border bg-card p-2.5 xl:sticky xl:top-2 xl:self-start">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Preview
          </p>
          {adapter.moduleKey === "PURCHASE_ORDER" ? (
            <DocumentLayoutPreview
              layout={layout}
              previewMode={previewMode}
              onPreviewModeChange={setPreviewMode}
            />
          ) : (
            <DocumentLayoutSimplePreview
              layout={layout}
              previewMode={previewMode}
              onPreviewModeChange={setPreviewMode}
            />
          )}
        </aside>
        ) : null}
      </div>

      {!embedded ? (
      <p className="text-[10px] text-muted-foreground">
        {adapter.label} · {layoutScopeKey(scope)} · {viewContext}
      </p>
      ) : null}
    </div>
  );
}
