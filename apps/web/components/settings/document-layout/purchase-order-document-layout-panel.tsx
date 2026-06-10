"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  loadPurchaseOrderDocumentLayout,
  savePurchaseOrderDocumentLayout,
} from "@/app/settings/modules/procurement/actions";
import { DocumentLayoutCatalogFieldsSection } from "@/components/settings/document-layout/document-layout-catalog-fields-section";
import { DocumentLayoutFieldList } from "@/components/settings/document-layout/document-layout-field-list";
import { DocumentLayoutPreview } from "@/components/settings/document-layout/document-layout-preview";
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
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  isPoPhase3LineColumn,
  movePoHeaderFieldOrder,
  movePoLineColumnOrder,
  movePoTotalsFieldOrder,
  normalizePoLayoutTemplate,
  patchPoLayoutColumn,
  type PoHeaderFieldId,
  type PoLineColumnId,
  type PoTotalsFieldId,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentImageDisplayMode, DocumentLayoutTemplate, DocumentViewContext } from "@/lib/documents/types";
import { DOCUMENT_LAYOUT_PRINT_EMAIL_ENABLED } from "@/lib/documents/types";
import type { PoCatalogFieldSuggestions } from "@/lib/procurement/purchase-orders/catalog-field-suggestions";
import {
  clearPoScreenLayoutLocalOverrides,
  hasPoScreenLayoutLocalOverrides,
} from "@/lib/documents/po-layout-local-overrides";
import { cn } from "@/lib/utils";

type Props = {
  initialLayout: DocumentLayoutTemplate;
  locations?: DocumentLayoutLocationOption[];
  canEdit?: boolean;
  catalogFieldSuggestions?: PoCatalogFieldSuggestions;
};

const VIEW_TABS: { id: DocumentViewContext; label: string; enabled: boolean }[] = [
  { id: "SCREEN_GRID", label: "On-screen", enabled: true },
  { id: "PDF_PRINT", label: "Print", enabled: DOCUMENT_LAYOUT_PRINT_EMAIL_ENABLED },
  { id: "EMAIL_HTML", label: "Email", enabled: DOCUMENT_LAYOUT_PRINT_EMAIL_ENABLED },
];

function hasDecimalPlaces(columnId: string): boolean {
  return [
    "quantity_ordered",
    "quantity_received",
    "unit_price",
    "line_total",
    "discount_pct",
    "discount_amount",
    "subtotal_ex_tax",
    "tax_amount",
    "grand_total",
  ].includes(columnId);
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

export function PurchaseOrderDocumentLayoutPanel({
  initialLayout,
  locations = [],
  canEdit = true,
  catalogFieldSuggestions,
}: Props) {
  const [scope, setScope] = useState<DocumentLayoutScope>(TENANT_LAYOUT_SCOPE);
  const [viewContext, setViewContext] = useState<DocumentViewContext>(
    initialLayout.viewContext ?? "SCREEN_GRID"
  );
  const [layout, setLayout] = useState<DocumentLayoutTemplate>(() =>
    normalizePoLayoutTemplate(initialLayout)
  );
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
      setLayout(normalizePoLayoutTemplate(initialLayout));
      return;
    }

    let cancelled = false;
    setIsLoadingLayout(true);
    void loadPurchaseOrderDocumentLayout({ viewContext, scope }).then((result) => {
      if (cancelled) return;
      setIsLoadingLayout(false);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to load document layout.");
        return;
      }
      hydratedScopeKey.current = scopeKey;
      hydratedViewContext.current = viewContext;
      setLayout(normalizePoLayoutTemplate(result.layout));
    });

    return () => {
      cancelled = true;
      setIsLoadingLayout(false);
    };
  }, [scope, viewContext, initialLayout]);

  const columnById = useMemo(() => new Map(layout.columns.map((column) => [column.id, column])), [layout.columns]);

  const getColumn = (id: string) => columnById.get(id);

  const patchColumn = (id: string, patch: Partial<(typeof layout.columns)[number]>) => {
    setLayout((current) => patchPoLayoutColumn(current, id, patch));
  };

  const handleReset = () => {
    setLayout(
      normalizePoLayoutTemplate({
        ...DEFAULT_PO_SCREEN_LAYOUT,
        viewContext,
      })
    );
    toast.message("Layout reset to defaults.");
  };

  const handleResetLocalOverrides = () => {
    clearPoScreenLayoutLocalOverrides();
    toast.success("Your on-screen layout overrides were cleared.");
  };

  const hasLocalOverrides = hasPoScreenLayoutLocalOverrides();

  const handleSave = () => {
    startTransition(async () => {
      const result = await savePurchaseOrderDocumentLayout({
        scope,
        viewContext,
        layout: {
          ...layout,
          viewContext,
        },
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
          <SectionBlock title="Header">
            <DocumentLayoutFieldList<PoHeaderFieldId>
              order={layout.headerFieldOrder as PoHeaderFieldId[]}
              getColumn={(id) => getColumn(id)}
              showTypographyColumns
              onPatch={patchColumn}
              onMove={(fromId, toId) =>
                setLayout((current) => movePoHeaderFieldOrder(current, fromId, toId))
              }
            />
          </SectionBlock>

          <SectionBlock title="Lines" hint="Column · Detail under item · inline flow">
            <DocumentLayoutFieldList<PoLineColumnId>
              order={layout.lineColumnOrder as PoLineColumnId[]}
              getColumn={(id) => getColumn(id)}
              showPresentationColumns
              showAlignColumn
              showDecimalsColumn
              showTypographyColumns
              getMeta={(id) => ({
                pinned: id === "item",
                draggable: id !== "item",
                lockLineSlot: id === "item" ? "column" : undefined,
                disabled: isPoPhase3LineColumn(id),
                disabledReason: isPoPhase3LineColumn(id)
                  ? "Requires Phase 3 discount settings"
                  : undefined,
                showAlign: true,
                showDecimalPlaces: hasDecimalPlaces(id),
              })}
              onPatch={patchColumn}
              onMove={(fromId, toId) =>
                setLayout((current) => movePoLineColumnOrder(current, fromId, toId))
              }
            />
          </SectionBlock>

          <SectionBlock
            title="Item catalog fields"
            hint="Read-only · from item master · under item cell"
          >
            <DocumentLayoutCatalogFieldsSection
              layout={layout}
              canEdit={!controlsDisabled}
              customFieldKeys={catalogFieldSuggestions?.customFieldKeys}
              variantAttributeKeys={catalogFieldSuggestions?.variantAttributeKeys}
              onLayoutChange={setLayout}
            />
          </SectionBlock>

          <SectionBlock title="Totals">
            <DocumentLayoutFieldList<PoTotalsFieldId>
              order={layout.totalsFieldOrder as PoTotalsFieldId[]}
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
                setLayout((current) => movePoTotalsFieldOrder(current, fromId, toId))
              }
            />
          </SectionBlock>

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
        </div>

        <aside className="min-w-0 rounded-md border border-border bg-card p-2.5 xl:sticky xl:top-2 xl:self-start">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Preview
          </p>
          <DocumentLayoutPreview
            layout={layout}
            previewMode={previewMode}
            onPreviewModeChange={setPreviewMode}
          />
        </aside>
      </div>

      <p className="text-[10px] text-muted-foreground">
        {layoutScopeKey(scope)} · {viewContext} · Saved per tenant and view context
      </p>
    </div>
  );
}
