"use client";

import Link from "next/link";
import { ProductFormBackLinkContent } from "@/components/products/product-form-back-link-content";import { ProductFormEditLinkContent } from "@/components/products/product-form-edit-link-content";
import { ProductEditorShell } from "@/components/products/product-editor/product-editor-shell";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import { Button } from "@/components/ui/button";
import { useRouteTransition } from "@/lib/navigation/use-route-transition";import type { CategoryRow } from "@/lib/categories/types";
import { mergeStorefrontVisibility } from "@/lib/products/storefront-visibility";
import {
  detailToFormValues,
  type ProductCatalogContext,
  type ProductDetailSnapshot,
} from "@/lib/products/types";

const ITEMS_HREF = "/inventory/items";

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
  const { push, replace, refresh, isPending: isNavigating } = useRouteTransition();

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

  const handleSaved = (itemId: string) => {
    if (mode === "create") {
      replace(`${ITEMS_HREF}/${itemId}/edit`);
    }
  };

  const handleCancel = () => {
    if (mode === "edit" && detail) {
      push(`${ITEMS_HREF}/${detail.id}`);
      return;
    }
    push(ITEMS_HREF);
  };

  const backHref =
    mode === "create" || !detail ? ITEMS_HREF : `${ITEMS_HREF}/${detail.id}`;

  return (
    <div className="canvas-scroll-endpad">
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={backHref} prefetch>
            <ProductFormBackLinkContent />
          </Link>
        </Button>
        {mode === "view" && detail ? (
          <Button size="sm" asChild>
            <Link href={`${ITEMS_HREF}/${detail.id}/edit`} prefetch>
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
