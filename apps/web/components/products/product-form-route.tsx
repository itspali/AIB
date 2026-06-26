"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { ProductFormEditLinkContent } from "@/components/products/product-form-edit-link-content";
import { ItemCatalogWizardEditor } from "@/components/items/item-editor/item-catalog-wizard-editor";
import {
  ProductEditorShell,
  type EditorWizardChrome,
} from "@/components/products/product-editor/product-editor-shell";
import { ProductFormSkeleton } from "@/components/products/product-form-skeleton";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import { Button } from "@/components/ui/button";
import { useRouteTransition } from "@/lib/navigation/use-route-transition";
import { useCatalogDrawerNavigation } from "@/lib/layout/list-module/use-catalog-drawer-navigation";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "@/lib/categories/types";
import {
  editorStageOrder,
  isEditorStageId,
  type EditorStageId,
} from "@/lib/products/editor-stages";
import type { WizardNav } from "@/lib/products/use-product-create-wizard";
import { SAVE_ITEM_LABEL, UPDATE_ITEM_LABEL } from "@/lib/products/product-user-labels";
import {
  ITEM_CATALOG_ORIGIN_PARAM,
  ITEM_CATALOG_ORIGIN_VALUE,
  ITEMS_HREF,
  isCatalogPopOutOrigin,
  itemEditHref,
  itemListReturnHref,
  itemPeekHref,
} from "@/lib/products/item-navigation";
import { mergeStorefrontVisibility } from "@/lib/products/storefront-visibility";
import {
  detailToFormValues,
  type ProductCatalogContext,
  type ProductDetailSnapshot,
} from "@/lib/products/types";

function wizardEditHref(itemId: string, stage: EditorStageId, fromCatalog: boolean): string {
  const base = itemEditHref(itemId);
  const params = new URLSearchParams({ stage });
  if (fromCatalog) params.set(ITEM_CATALOG_ORIGIN_PARAM, ITEM_CATALOG_ORIGIN_VALUE);
  return `${base}&${params.toString()}`;
}

type Props = {
  mode: ProductFormMode;
  tenantId: string;
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext;
  detail?: ProductDetailSnapshot | null;
  lockedFields?: string[];
};

/**
 * Full-page, deep-linkable presentation of the product master form. Renders the
 * responsive ProductEditorShell on the shared headless useProductForm core, and
 * owns the create -> edit redirect so a freshly saved item lands on its own
 * editable URL with variants/media unlocked.
 */
export function ProductFormRoute({
  mode,
  tenantId,
  categories,
  catalogContext,
  detail = null,
  lockedFields = [],
}: Props) {
  const searchParams = useSearchParams();
  const { replace, refresh, isPending } = useRouteTransition();
  const { navigate, isPending: isDrawerNavPending } = useCatalogDrawerNavigation(ITEMS_HREF);
  const isNavigating = isPending || isDrawerNavPending;
  const fromCatalog = isCatalogPopOutOrigin(searchParams);
  const itemId = detail?.id;

  // --- Guided item wizard (create + edit) ------------------------------------
  const stageParam = searchParams.get("stage");
  const wizardActive = mode === "create" || mode === "edit";
  const currentStage: EditorStageId =
    mode === "create" ? "essentials" : isEditorStageId(stageParam) ? stageParam : "essentials";

  const renderMultiSku = (detail?.variant_strategy ?? "SINGLE_SKU") === "MULTI_SKU";
  const renderHasComposition = detail?.is_bundle ?? false;
  const renderOrder = editorStageOrder({
    isMultiSku: renderMultiSku,
    hasComposition: renderHasComposition,
  });
  const renderIndex = Math.max(0, renderOrder.indexOf(currentStage));
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { requestClose, discardDialog } = useDiscardChangesConfirmation({ hasUnsavedChanges });

  // The shell hands us its submit trigger; nav buttons set intent then save.
  const submitRef = useRef<((nav: WizardNav) => void) | null>(null);
  const navRef = useRef<WizardNav>({ type: "primary" });

  const initialValues =
    detail && mode !== "create"
      ? {
          ...detailToFormValues(detail),
          storefront_visibility: mergeStorefrontVisibility(
            catalogContext.storefronts,
            detailToFormValues(detail).storefront_visibility
          ),
        }
      : undefined;

  const handleSaved = (
    savedItemId: string,
    savedDetail?: ProductDetailSnapshot | null
  ) => {
    if (!wizardActive) return;
    if (wizardLayout === "accordion") return;

    // Recompute the stage order from the just-saved strategy so single-SKU
    // Single-SKU products skip the Variants stage even when strategy changed during Essentials.
    const multi =
      (savedDetail?.variant_strategy ?? detail?.variant_strategy ?? "SINGLE_SKU") === "MULTI_SKU";
    const composition = savedDetail?.is_bundle ?? detail?.is_bundle ?? false;
    const order = editorStageOrder({
      isMultiSku: multi,
      hasComposition: composition,
    });
    const at = Math.max(0, order.indexOf(currentStage));
    const nav = navRef.current;
    navRef.current = { type: "primary" };

    const finish = () => navigate(itemPeekHref(savedItemId));

    if (nav.type === "exit") return finish();
    if (nav.type === "stage") {
      return replace(wizardEditHref(savedItemId, nav.stage, fromCatalog));
    }
    if (nav.type === "back") {
      const previous = order[at - 1];
      return previous
        ? replace(wizardEditHref(savedItemId, previous, fromCatalog))
        : finish();
    }
    const next = order[at + 1];
    return next ? replace(wizardEditHref(savedItemId, next, fromCatalog)) : finish();
  };

  const wizardLayout = mode === "edit" ? "accordion" : "steps";

  const wizard: EditorWizardChrome | undefined = wizardActive
    ? {
        layout: wizardLayout,
        stage: currentStage,
        isFirst: renderIndex === 0,
        isLast: renderIndex === renderOrder.length - 1,
        onBack: () => {
          navRef.current = { type: "back" };
          submitRef.current?.(navRef.current);
        },
        onSkip: () => {
          navRef.current = { type: "exit" };
          submitRef.current?.(navRef.current);
        },
        onPrimary: () => {
          navRef.current = { type: "primary" };
          submitRef.current?.(navRef.current);
        },
        onSelectStage: (stage) => {
          navRef.current = { type: "stage", stage };
          submitRef.current?.(navRef.current);
        },
        registerSubmit: (fn) => {
          submitRef.current = fn;
        },
      }
    : undefined;

  const handleCancel = () => {
    if (fromCatalog) {
      navigate(itemListReturnHref(detail?.id));
      return;
    }
    if (mode === "edit" && detail) {
      navigate(itemPeekHref(detail.id));
      return;
    }
    navigate(itemListReturnHref());
  };

  const handleHeaderClose = () => {
    requestClose(handleCancel);
  };

  const handleHeaderSave = () => {
    navRef.current = { type: "primary" };
    submitRef.current?.(navRef.current);
  };

  // Wizard pages scroll inside the form column only — not the dashboard main pane.
  useEffect(() => {
    if (!wizardActive) return;
    const main = document.querySelector<HTMLElement>("[data-dashboard-scroll-root]");
    const pad = main?.firstElementChild;
    if (!main) return;

    const previousOverflow = main.style.overflow;
    const padEl = pad instanceof HTMLElement ? pad : null;
    const previousPadMinHeight = padEl?.style.minHeight ?? "";
    const previousPadHeight = padEl?.style.height ?? "";

    main.style.overflow = "hidden";
    if (padEl) {
      padEl.style.minHeight = "0";
      padEl.style.height = "100%";
    }

    return () => {
      main.style.overflow = previousOverflow;
      if (padEl) {
        padEl.style.minHeight = previousPadMinHeight;
        padEl.style.height = previousPadHeight;
      }
    };
  }, [wizardActive]);

  return (
    <div className={cn(wizardActive ? "item-wizard-workspace" : "canvas-scroll-endpad")}>
      <div
        className={cn(
          "flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-border/70 pb-2",
          wizardActive ? "mb-2" : "mb-4"
        )}
      >
        <div className="flex min-w-0 flex-col gap-2">
          {mode === "create" ? (
            <div className="min-w-0">
              <h1 className="text-lg font-semibold tracking-tight sm:text-xl">New item</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Create a new catalog item.
              </p>
            </div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {mode !== "view" && wizardActive ? (
            <Button
              size="sm"
              disabled={isSaving || isNavigating}
              onClick={handleHeaderSave}
              title="Save (Cmd/Ctrl + Enter)"
            >
              {isSaving
                ? "Saving..."
                : wizardLayout === "accordion"
                  ? mode === "edit"
                    ? UPDATE_ITEM_LABEL
                    : SAVE_ITEM_LABEL
                  : "Save & continue"}
            </Button>
          ) : null}
          {mode === "view" && detail ? (
            <Button size="sm" asChild>
              <Link href={itemEditHref(detail.id)} prefetch>
                <ProductFormEditLinkContent />
              </Link>
            </Button>
          ) : null}
          {mode !== "view" ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close form"
              title="Close"
              onClick={handleHeaderClose}
              disabled={isSaving || isNavigating}
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      </div>

      <div
        className={cn(
          wizardActive && "flex min-h-0 flex-1 flex-col overflow-hidden"
        )}
      >
        {wizard ? (
          <ItemCatalogWizardEditor
            key={`${detail?.id ?? "new"}-${mode}`}
            mode={mode}
            tenantId={tenantId}
            categories={categories}
            catalogContext={catalogContext}
            detail={detail}
            valuations={detail?.valuations}
            variants={detail?.variants}
            media={detail?.media}
            initialValues={initialValues}
            lockedFields={lockedFields}
            onCancel={handleHeaderClose}
            onSaved={handleSaved}
            isNavigatePending={isNavigating}
            onPendingChange={setIsSaving}
            onDirtyChange={setHasUnsavedChanges}
            onExtensionsChanged={() => refresh()}
            wizard={wizard}
          />
        ) : (
          <ProductEditorShell
            key={`${detail?.id ?? "new"}-${mode}`}
            mode={mode}
            tenantId={tenantId}
            categories={categories}
            catalogContext={catalogContext}
            detail={detail}
            valuations={detail?.valuations}
            variants={detail?.variants}
            media={detail?.media}
            initialValues={initialValues}
            lockedFields={lockedFields}
            onCancel={handleHeaderClose}
            onSaved={handleSaved}
            isNavigatePending={isNavigating}
            onPendingChange={setIsSaving}
            onDirtyChange={setHasUnsavedChanges}
            onExtensionsChanged={() => refresh()}
          />
        )}
      </div>
      {discardDialog}
    </div>
  );
}

export function ProductFormRouteWithSuspense(props: Props) {
  return (
    <Suspense fallback={<ProductFormSkeleton />}>
      <ProductFormRoute {...props} />
    </Suspense>
  );
}
