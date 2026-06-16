"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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

type Props = {
  adapter: DocumentLayoutModuleAdapter;
  initialLayout: DocumentLayoutTemplate;
  locations?: DocumentLayoutLocationOption[];
  canEdit?: boolean;
  gstRegistered?: boolean;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
  loadLayout: LoadLayoutFn;
  saveLayout: SaveLayoutFn;
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
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
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

export function DocumentLayoutPanel({
  adapter,
  initialLayout,
  locations = [],
  canEdit = true,
  gstRegistered = false,
  catalogFieldSuggestions,
  loadLayout,
  saveLayout,
}: Props) {
  const applyGstCompliance = (template: DocumentLayoutTemplate) => {
    const normalized = adapter.normalize(template);
    return gstRegistered
      ? applyGstRegisteredDocumentLayoutOverrides(normalized, true, adapter.catalog.createPref)
      : normalized;
  };

  const [scope, setScope] = useState<DocumentLayoutScope>(TENANT_LAYOUT_SCOPE);
  const [viewContext, setViewContext] = useState<DocumentViewContext>(
    initialLayout.viewContext ?? "SCREEN_GRID"
  );
  const [layout, setLayout] = useState<DocumentLayoutTemplate>(() => applyGstCompliance(initialLayout));
  const [previewMode, setPreviewMode] = useState<"drawer" | "peek">("drawer");
  const [isPending, startTransition] = useTransition();
  const [isLoadingLayout, setIsLoadingLayout] = useState(false);
  const hydratedScopeKey = useRef(layoutScopeKey(TENANT_LAYOUT_SCOPE));
  const hydratedViewContext = useRef(initialLayout.viewContext ?? "SCREEN_GRID");

  useEffect(() => {
    const scopeKey = layoutScopeKey(scope);
    const isInitialHydration =
      scopeKey === hydratedScopeKey.current &&
      viewContext === hydratedViewContext.current &&
      viewContext === (initialLayout.viewContext ?? "SCREEN_GRID");

    if (isInitialHydration) {
      setLayout(applyGstCompliance(initialLayout));
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
      hydratedScopeKey.current = scopeKey;
      hydratedViewContext.current = viewContext;
      setLayout(applyGstCompliance(result.layout));
    });

    return () => {
      cancelled = true;
      setIsLoadingLayout(false);
    };
  }, [adapter, scope, viewContext, initialLayout, loadLayout]);

  useEffect(() => {
    setLayout((current) => applyGstCompliance(current));
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
    setLayout((current) => adapter.patchColumn(current, id, patch));
  };

  const handleReset = () => {
    setLayout(
      applyGstCompliance({
        ...adapter.defaultLayout,
        viewContext,
      })
    );
    toast.message("Layout reset to defaults.");
  };

  const handleResetLocalOverrides = () => {
    if (adapter.moduleKey !== "PURCHASE_ORDER") return;
    clearPoScreenLayoutLocalOverrides();
    toast.success("Your on-screen layout overrides were cleared.");
  };

  const hasLocalOverrides =
    adapter.moduleKey === "PURCHASE_ORDER" && hasPoScreenLayoutLocalOverrides();

  const handleSave = () => {
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
      toast.success("Document layout saved.");
    });
  };

  const controlsDisabled = !canEdit || isPending || isLoadingLayout;
  const lineOrder = adapter.getLineSettingsColumnOrder(layout);
  const headerOrder = layout.headerFieldOrder;
  const totalsOrder = layout.totalsFieldOrder.filter(
    (id) => !adapter.totalsInternalFieldIds.includes(id)
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-3">
          <DocumentLayoutScopeSelect
            scope={scope}
            locations={locations}
            disabled={!canEdit}
            onScopeChange={setScope}
          />
          <Tabs
            value={viewContext}
            onValueChange={(value) => setViewContext(value as DocumentViewContext)}
          >
            <TabsList className="h-7">
              {VIEW_TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id} disabled={!tab.enabled} className="h-6 px-2 text-xs">
                  {tab.label}
                  {!tab.enabled ? "*" : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-center gap-1.5">
          {viewContext === "SCREEN_GRID" && hasLocalOverrides ? (
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
            {isPending ? "Saving…" : isLoadingLayout ? "Loading…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
        <div className="min-w-0 space-y-3 rounded-md border border-border bg-card p-2.5 sm:p-3">
          <SectionBlock title="Header" hint="Header · top row · Details · side panel">
            <DocumentLayoutFieldList
              order={headerOrder}
              getColumn={(id) => getColumn(id)}
              showHeaderPlacementColumns
              showTypographyColumns
              getMeta={(id) => ({
                showHeaderPlacement: adapter.isFormHeaderPlaceableField(id),
              })}
              onPatch={patchColumn}
              onMove={(fromId, toId) =>
                setLayout((current) => adapter.moveHeaderFieldOrder(current, fromId, toId))
              }
            />
          </SectionBlock>

          <SectionBlock title="Lines" hint="Column · Detail">
            <DocumentLayoutFieldList
              order={lineOrder}
              getColumn={(id) => getColumn(id)}
              showPresentationColumns
              showAlignColumn
              showDecimalsColumn
              showTypographyColumns
              getMeta={(id) => ({
                pinned: id === "item",
                draggable: id !== "item",
                lockLineSlot: id === "item" ? "column" : undefined,
                showAlign: true,
                showDecimalPlaces: hasDecimalPlaces(id),
              })}
              onPatch={patchColumn}
              onMove={(fromId, toId) =>
                setLayout((current) => adapter.moveLineColumnOrder(current, fromId, toId))
              }
            />
          </SectionBlock>

          {adapter.showCatalogSection ? (
            <SectionBlock
              title="Item catalog fields"
              hint={
                gstRegistered
                  ? "HSN/SAC required · read-only · from item master · under item cell"
                  : "Read-only · from item master · under item cell"
              }
            >
              <DocumentLayoutCatalogFieldsSection
                layout={layout}
                canEdit={!controlsDisabled}
                gstRegistered={gstRegistered}
                catalogAdapter={adapter.catalog}
                customFieldKeys={catalogFieldSuggestions?.customFieldKeys}
                variantAttributeKeys={catalogFieldSuggestions?.variantAttributeKeys}
                onLayoutChange={setLayout}
              />
            </SectionBlock>
          ) : null}

          {adapter.showTotalsSection ? (
            <SectionBlock title="Totals">
              <DocumentLayoutFieldList
                order={totalsOrder}
                getColumn={(id) => getColumn(id)}
                showAlignColumn
                showDecimalsColumn
                showTypographyColumns
                getMeta={(id) => ({
                  showAlign: true,
                  showDecimalPlaces: hasDecimalPlaces(id),
                })}
                onPatch={patchColumn}
                onMove={(fromId, toId) =>
                  adapter.moveTotalsFieldOrder
                    ? setLayout((current) => adapter.moveTotalsFieldOrder!(current, fromId, toId))
                    : undefined
                }
              />
            </SectionBlock>
          ) : null}

          {adapter.showImageSection ? (
            <SectionBlock title="Line images" hint="On-screen drawer · print">
              <Select
                value={layout.imageDisplayMode}
                disabled={controlsDisabled}
                onValueChange={(value) =>
                  setLayout((current) => ({
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
        </div>

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
      </div>

      <p className="text-[10px] text-muted-foreground">
        {adapter.label} · {layoutScopeKey(scope)} · {viewContext}
      </p>
    </div>
  );
}
