"use client";

import Link from "next/link";
import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ProductFormBackLinkContent } from "@/components/products/product-form-back-link-content";
import { ProductFormEditLinkContent } from "@/components/products/product-form-edit-link-content";
import { ProductEditorShell } from "@/components/products/product-editor/product-editor-shell";
import { ProductFormSkeleton } from "@/components/products/product-form-skeleton";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import { Button } from "@/components/ui/button";
import { useRouteTransition } from "@/lib/navigation/use-route-transition";
import type { CategoryRow } from "@/lib/categories/types";
import {
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

  const handleSaved = (savedItemId: string) => {
    if (mode === "create") {
      replace(itemFullPageHref("edit", savedItemId, { fromCatalog }));
    }
  };

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
