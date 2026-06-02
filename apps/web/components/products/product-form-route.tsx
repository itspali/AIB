"use client";

import Link from "next/link";
import { Suspense, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { ProductFormBackLinkContent } from "@/components/products/product-form-back-link-content";
import { ProductFormEditLinkContent } from "@/components/products/product-form-edit-link-content";
import {
  ProductEditorShell,
  type EditorWizardChrome,
} from "@/components/products/product-editor/product-editor-shell";
import { ProductFormSkeleton } from "@/components/products/product-form-skeleton";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import { Button } from "@/components/ui/button";
import { useRouteTransition } from "@/lib/navigation/use-route-transition";
import type { CategoryRow } from "@/lib/categories/types";
import {
  editorStageOrder,
  isEditorStageId,
  type EditorStageId,
} from "@/lib/products/editor-stages";
import {
  ITEM_CATALOG_ORIGIN_PARAM,
  ITEM_CATALOG_ORIGIN_VALUE,
  ITEMS_HREF,
  isCatalogPopOutOrigin,
  itemFullPageHref,
  itemListReturnHref,
  resolveItemFormBackHref,
  resolveItemFormBackLabel,
} from "@/lib/products/item-navigation";
import { mergeStorefrontVisibility } from "@/lib/products/storefront-visibility";
import {
  detailToFormValues,
  type ProductCatalogContext,
  type ProductDetailSnapshot,
} from "@/lib/products/types";

/** Where a stage-navigation save should land once the item is persisted. */
type WizardNav =
  | { type: "primary" }
  | { type: "back" }
  | { type: "exit" }
  | { type: "stage"; stage: EditorStageId };

function wizardEditHref(itemId: string, stage: EditorStageId, fromCatalog: boolean): string {
  const params = new URLSearchParams({ wizard: "1", stage });
  if (fromCatalog) params.set(ITEM_CATALOG_ORIGIN_PARAM, ITEM_CATALOG_ORIGIN_VALUE);
  return `${ITEMS_HREF}/${itemId}/edit?${params.toString()}`;
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
  const { push, replace, refresh, isPending: isNavigating } = useRouteTransition();
  const fromCatalog = isCatalogPopOutOrigin(searchParams);
  const itemId = detail?.id;

  // --- Guided create wizard ------------------------------------------------
  // Create is always staged; an existing item only stages when ?wizard=1 is
  // present (so editing from the list keeps the full sectioned editor).
  const stageParam = searchParams.get("stage");
  const wizardActive = mode === "create" || (mode === "edit" && searchParams.get("wizard") === "1");
  const currentStage: EditorStageId =
    mode === "create" ? "essentials" : isEditorStageId(stageParam) ? stageParam : "essentials";

  const renderMultiSku = (detail?.variant_strategy ?? "SINGLE_SKU") === "MULTI_SKU";
  const renderOrder = editorStageOrder(renderMultiSku);
  const renderIndex = Math.max(0, renderOrder.indexOf(currentStage));

  // The shell hands us its submit trigger; nav buttons set intent then save.
  const submitRef = useRef<(() => void) | null>(null);
  const navRef = useRef<WizardNav>({ type: "primary" });

  const backHref = useMemo(
    () => resolveItemFormBackHref(mode, itemId, fromCatalog),
    [fromCatalog, itemId, mode]
  );
  const backLabel = useMemo(
    () => resolveItemFormBackLabel(fromCatalog, mode),
    [fromCatalog, mode]
  );

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
    // Create always runs the wizard, so a non-wizard save here is an existing
    // item being edited from the list — nothing to navigate.
    if (!wizardActive) return;

    // Recompute the stage order from the just-saved strategy so single-SKU
    // items skip Versions even when the choice changed during Essentials.
    const multi =
      (savedDetail?.variant_strategy ?? detail?.variant_strategy ?? "SINGLE_SKU") === "MULTI_SKU";
    const order = editorStageOrder(multi);
    const at = Math.max(0, order.indexOf(currentStage));
    const nav = navRef.current;
    navRef.current = { type: "primary" };

    const finish = () => push(itemFullPageHref("view", savedItemId, { fromCatalog }));

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

  const wizard: EditorWizardChrome | undefined = wizardActive
    ? {
        stage: currentStage,
        isFirst: renderIndex === 0,
        isLast: renderIndex === renderOrder.length - 1,
        onBack: () => {
          navRef.current = { type: "back" };
          submitRef.current?.();
        },
        onSkip: () => {
          navRef.current = { type: "exit" };
          submitRef.current?.();
        },
        onPrimary: () => {
          navRef.current = { type: "primary" };
          submitRef.current?.();
        },
        onSelectStage: (stage) => {
          navRef.current = { type: "stage", stage };
          submitRef.current?.();
        },
        registerSubmit: (fn) => {
          submitRef.current = fn;
        },
      }
    : undefined;

  const handleCancel = () => {
    if (fromCatalog) {
      push(itemListReturnHref(detail?.id));
      return;
    }
    if (mode === "edit" && detail) {
      push(itemFullPageHref("view", detail.id));
      return;
    }
    push(itemListReturnHref());
  };

  return (
    <div className="canvas-scroll-endpad">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref} prefetch>
            <ProductFormBackLinkContent label={backLabel} />
          </Link>
        </Button>
        {mode === "view" && detail ? (
          <Button size="sm" asChild>
            <Link href={itemFullPageHref("edit", detail.id, { fromCatalog })} prefetch>
              <ProductFormEditLinkContent />
            </Link>
          </Button>
        ) : null}
      </div>

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
        onCancel={handleCancel}
        onSaved={handleSaved}
        isNavigatePending={isNavigating}
        onExtensionsChanged={() => refresh()}
        wizard={wizard}
      />
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
