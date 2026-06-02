"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ExternalLink, Pencil } from "lucide-react";
import { toast } from "sonner";
import { getItemEditability } from "@/app/items/actions";

import { ProductEditorShell } from "@/components/products/product-editor/product-editor-shell";
import { ProductEditorSkeleton } from "@/components/products/product-editor/product-editor-skeleton";
import { Button } from "@/components/ui/button";
import type { CategoryRow } from "@/lib/categories/types";
import {
  canEditAnyProductFormField,
  type ProductFieldPermissions,
} from "@/lib/products/field-permissions";
import { mergeStorefrontVisibility } from "@/lib/products/storefront-visibility";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import {
  detailToFormValues,
  type ProductCatalogContext,
  type ProductDetailSnapshot,
} from "@/lib/products/types";
import { pickPrimaryImagePreviewUrl } from "@/lib/products/primary-image";

import {
  itemFullPageHref,
  ITEMS_HREF,
} from "@/lib/products/item-navigation";

type PanelProps = {
  mode: ProductFormMode;
  tenantId: string;
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext | null;
  detail?: ProductDetailSnapshot | null;
  fieldPermissions: ProductFieldPermissions;
  isLoading?: boolean;
  onModeChange: (mode: ProductFormMode) => void;
  onSaved: (itemId: string, detail?: ProductDetailSnapshot | null) => void;
  onExtensionsChanged?: () => void;
  onClose: () => void;
  children: ReactNode;
};

type PanelContextValue = {
  mode: ProductFormMode;
  detail: ProductDetailSnapshot | null;
  canEdit: boolean;
  isLoadingEditability: boolean;
  fullPageHref: string;
  onEdit: () => void;
  fieldPermissions: ProductFieldPermissions;
};

const ProductPanelContext = createContext<PanelContextValue | null>(null);

function useProductPanelContext(): PanelContextValue {
  const value = useContext(ProductPanelContext);
  if (!value) {
    throw new Error("Product panel components must be used within ProductPanelScope.");
  }
  return value;
}

function resolveFullPageHref(mode: ProductFormMode, detail: ProductDetailSnapshot | null): string {
  if (mode === "create") return itemFullPageHref("create", null, { fromCatalog: true });
  if (!detail) return ITEMS_HREF;
  return itemFullPageHref(mode, detail.id, { fromCatalog: true });
}

/** Shares panel edit/save state between the detail header actions and editor body. */
export function ProductPanelScope({
  mode,
  tenantId,
  categories,
  catalogContext,
  detail = null,
  fieldPermissions,
  isLoading = false,
  onModeChange,
  onSaved,
  onExtensionsChanged,
  onClose,
  children,
}: PanelProps) {
  const [lockedFields, setLockedFields] = useState<string[]>([]);
  const [isLoadingEditability, startEditabilityTransition] = useTransition();

  const canEdit = canEditAnyProductFormField(fieldPermissions);

  const initialValues = useMemo(() => {
    if (!detail || mode === "create" || !catalogContext) return undefined;
    return {
      ...detailToFormValues(detail),
      storefront_visibility: mergeStorefrontVisibility(
        catalogContext.storefronts,
        detailToFormValues(detail).storefront_visibility
      ),
    };
  }, [catalogContext, detail, mode]);

  const handleEdit = useCallback(() => {
    if (!detail) return;
    onModeChange("edit");
    startEditabilityTransition(async () => {
      const result = await getItemEditability(detail.id);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to load edit restrictions.");
        setLockedFields([]);
        return;
      }
      setLockedFields(result.editability.locked_fields);
    });
  }, [detail, onModeChange]);

  const handleCancel = useCallback(() => {
    if (mode === "edit" && detail) {
      setLockedFields([]);
      onModeChange("view");
      return;
    }
    onClose();
  }, [detail, mode, onClose, onModeChange]);

  const handleSaved = useCallback(
    (itemId: string, savedDetail?: ProductDetailSnapshot | null) => {
      if (mode === "create") {
        onModeChange("edit");
      } else if (mode === "edit") {
        setLockedFields([]);
        onModeChange("view");
      }
      onSaved(itemId, savedDetail);
    },
    [mode, onModeChange, onSaved]
  );

  const fullPageHref = resolveFullPageHref(mode, detail);

  const contextValue = useMemo<PanelContextValue>(
    () => ({
      mode,
      detail,
      canEdit,
      isLoadingEditability,
      fullPageHref,
      onEdit: handleEdit,
      fieldPermissions,
    }),
    [
      mode,
      detail,
      canEdit,
      isLoadingEditability,
      fullPageHref,
      handleEdit,
      fieldPermissions,
    ]
  );

  const body =
    isLoading || !catalogContext ? (
      <ProductEditorSkeleton />
    ) : (
      <ProductEditorShell
        key={`${detail?.id ?? "new"}-${mode}`}
        layout="panel"
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
        fieldPermissions={fieldPermissions}
        onCancel={handleCancel}
        onSaved={handleSaved}
        onExtensionsChanged={onExtensionsChanged}
      />
    );

  return (
    <ProductPanelContext.Provider value={contextValue}>
      <ProductPanelBodyContext.Provider value={body}>{children}</ProductPanelBodyContext.Provider>
    </ProductPanelContext.Provider>
  );
}

const ProductPanelBodyContext = createContext<ReactNode>(null);

export function ProductPanelHeaderActions() {
  const { mode, detail, canEdit, isLoadingEditability, fullPageHref, onEdit } =
    useProductPanelContext();

  return (
    <>
      {mode === "view" && detail && canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onEdit}
          disabled={isLoadingEditability}
          aria-label="Edit item"
          title="Edit"
        >
          <Pencil className="h-4 w-4" />
        </Button>
      ) : null}
      <Button asChild variant="ghost" size="sm" aria-label="Open full page" title="Open full page">
        <Link href={fullPageHref} prefetch>
          <ExternalLink className="h-4 w-4" />
        </Link>
      </Button>
    </>
  );
}

export function ProductPanelBody() {
  return useContext(ProductPanelBodyContext);
}

export function resolveProductPanelTitle(
  mode: ProductFormMode,
  detail: ProductDetailSnapshot | null
): string {
  if (mode === "create") return "New item";
  return detail?.name?.trim() ? detail.name : "Item";
}

export function resolveProductPanelDescription(
  mode: ProductFormMode,
  detail: ProductDetailSnapshot | null
): string | undefined {
  if (mode === "create") return "Create a new item master profile";
  if (detail?.sku) return detail.sku;
  return undefined;
}

export function resolveProductPanelImageUrl(
  mode: ProductFormMode,
  detail: ProductDetailSnapshot | null
): string | null {
  if (mode === "create" || !detail) return null;
  return pickPrimaryImagePreviewUrl(detail.media, detail.variant_id);
}
