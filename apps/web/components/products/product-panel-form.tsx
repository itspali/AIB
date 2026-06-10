"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import Link from "next/link";
import { ExternalLink, LayoutList, Pencil, Table2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { bulkArchiveItems, getItemEditability } from "@/app/items/actions";
import { ProductItemArchiveAlert } from "@/components/products/product-item-archive-alert";
import { PanelMutationPrimaryButton } from "@/components/products/panel-mutation-primary-button";

import {
  ProductEditorShell,
  type EditorWizardChrome,
} from "@/components/products/product-editor/product-editor-shell";
import { ProductEditorSkeleton } from "@/components/products/product-editor/product-editor-skeleton";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { CategoryRow } from "@/lib/categories/types";
import { useDiscardChangesConfirmation } from "@/lib/forms/use-discard-changes-confirmation";
import {
  canEditAnyProductFormField,
  type ProductFieldPermissions,
} from "@/lib/products/field-permissions";
import { resolveEffectiveAttributeTemplates } from "@/lib/categories/tree";
import { mergeStorefrontVisibility } from "@/lib/products/storefront-visibility";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import {
  detailToFormValues,
  isVariantCatalogEditMode,
  resolveDetailIdentitySku,
  selectedSellableVariant,
  type ProductCatalogContext,
  type ProductDetailSnapshot,
  type ProductVariantSnapshot,
} from "@/lib/products/types";
import { pickPrimaryImagePreviewUrl } from "@/lib/products/primary-image";
import { blurActiveElement } from "@/lib/dom/focus";
import type { ProductPeekPanelId } from "@/lib/products/peek-panels";

import {
  itemFullPageHref,
  ITEMS_HREF,
} from "@/lib/products/item-navigation";
import { ProductItemSummaryCard } from "@/components/products/product-item-summary-card";
import { VariantCatalogEditForm } from "@/components/products/variant-drawer-form";

export type PanelViewLayout = "compact" | "full";

const LAYOUT_CYCLE: PanelViewLayout[] = ["compact", "full"];

function nextLayout(current: PanelViewLayout): PanelViewLayout {
  const idx = LAYOUT_CYCLE.indexOf(current);
  return LAYOUT_CYCLE[(idx + 1) % LAYOUT_CYCLE.length];
}

const LAYOUT_META: Record<PanelViewLayout, { icon: React.ReactNode; label: string; next: string }> = {
  compact: {
    icon: <LayoutList className="h-4 w-4" aria-hidden />,
    label: "Profile summary",
    next: "Switch to full form",
  },
  full: {
    icon: <Table2 className="h-4 w-4" aria-hidden />,
    label: "Full form",
    next: "Switch to profile summary",
  },
};

export type ProductPanelUrlNavigation = {
  onOpenEdit: () => void;
  onPeekAfterSave: (itemId: string, detail?: ProductDetailSnapshot | null) => void;
  onClose: () => void;
};

type PanelProps = {
  mode: ProductFormMode;
  tenantId: string;
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext | null;
  detail?: ProductDetailSnapshot | null;
  fieldPermissions: ProductFieldPermissions;
  isLoading?: boolean;
  isDetailRefreshing?: boolean;
  onModeChange: (mode: ProductFormMode) => void;
  onSaved: (itemId: string, detail?: ProductDetailSnapshot | null) => void;
  onExtensionsChanged?: () => void;
  onRequestFullDetail?: () => void;
  onVariantPatch?: (variantId: string, patch: Partial<ProductVariantSnapshot>) => void;
  onVariantsReload?: () => void | Promise<void>;
  onClose: () => void;
  /** After a successful archive (delete) from the panel header. */
  onItemArchived?: (itemId: string) => void;
  urlNavigation?: ProductPanelUrlNavigation;
  wizard?: EditorWizardChrome;
  peekPanel?: ProductPeekPanelId;
  onPeekPanelChange?: (panel: ProductPeekPanelId) => void;
  peekPanelLoading?: ProductPeekPanelId | null;
  isValuationsLoading?: boolean;
  children: ReactNode;
};

export type ProductPanelMutationHeader =
  | {
      variant: "edit";
      onCancel: () => void;
      onSave: () => void;
      isPending: boolean;
      isNavigatePending: boolean;
      saveLabel: string;
    }
  | {
      variant: "wizard";
      isFirst: boolean;
      isLast: boolean;
      onBack: () => void;
      onCancel: () => void;
      onSkip: () => void;
      onPrimary: () => void;
      isPending: boolean;
      isNavigatePending: boolean;
      primaryLabel: string;
    };

type PanelContextValue = {
  mode: ProductFormMode;
  detail: ProductDetailSnapshot | null;
  canEdit: boolean;
  isLoadingEditability: boolean;
  isDetailRefreshing: boolean;
  fullPageHref: string;
  onEdit: () => void;
  onDismiss: () => void;
  fieldPermissions: ProductFieldPermissions;
  mutationHeader: ProductPanelMutationHeader | null;
  setMutationHeader: (header: ProductPanelMutationHeader | null) => void;
  viewLayout: PanelViewLayout;
  setViewLayout: (layout: PanelViewLayout) => void;
  onItemArchived?: (itemId: string) => void;
  catalogContext: ProductCatalogContext | null;
};

const ProductPanelContext = createContext<PanelContextValue | null>(null);

export function useProductPanelContext(): PanelContextValue {
  const value = useContext(ProductPanelContext);
  if (!value) {
    throw new Error("Product panel components must be used within ProductPanelScope.");
  }
  return value;
}

function resolveFullPageHref(mode: ProductFormMode, detail: ProductDetailSnapshot | null): string {
  if (mode === "create") return itemFullPageHref("create", null, { fromCatalog: true });
  if (!detail) return ITEMS_HREF;
  const variantId = isVariantCatalogEditMode(mode, detail) ? detail.variant_id : null;
  return itemFullPageHref(mode, detail.id, { fromCatalog: true, variantId });
}

/** Shares panel edit/save state between the detail header actions and editor body. */
const PANEL_LAYOUT_KEY = "aib-item-drawer-layout";

function readStoredLayout(): PanelViewLayout {
  if (typeof window === "undefined") return "compact";
  try {
    const stored = sessionStorage.getItem(PANEL_LAYOUT_KEY);
    if (stored === "minimal-form") return "full";
    if (stored === "full" || stored === "compact") return stored;
    return "compact";
  } catch {
    return "compact";
  }
}

function persistLayout(layout: PanelViewLayout) {
  try {
    sessionStorage.setItem(PANEL_LAYOUT_KEY, layout);
  } catch {
    /* ignore */
  }
}

export function ProductPanelScope({
  mode,
  tenantId,
  categories,
  catalogContext,
  detail = null,
  fieldPermissions,
  isLoading = false,
  isDetailRefreshing = false,
  onModeChange,
  onSaved,
  onExtensionsChanged,
  onRequestFullDetail,
  onVariantPatch,
  onVariantsReload,
  onClose,
  onItemArchived,
  urlNavigation,
  wizard,
  peekPanel,
  onPeekPanelChange,
  peekPanelLoading,
  isValuationsLoading = false,
  children,
}: PanelProps) {
  const [lockedFields, setLockedFields] = useState<string[]>([]);
  const [mutationHeader, setMutationHeader] = useState<ProductPanelMutationHeader | null>(null);
  const [viewLayout, setViewLayoutState] = useState<PanelViewLayout>("compact");
  const [isLoadingEditability, startEditabilityTransition] = useTransition();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const setViewLayout = useCallback(
    (layout: PanelViewLayout) => {
      if (mode !== "view") {
        persistLayout(layout);
      }
      setViewLayoutState(layout);
      if (layout === "full" && detail?.detail_scope === "peek") {
        onRequestFullDetail?.();
      }
    },
    [detail?.detail_scope, mode, onRequestFullDetail]
  );

  useEffect(() => {
    if (mode === "view") {
      setViewLayoutState("compact");
      return;
    }
    setViewLayoutState(readStoredLayout());
  }, [mode, detail?.id, detail?.variant_id]);

  useEffect(() => {
    if (mode === "view") setMutationHeader(null);
  }, [mode]);
  useEffect(() => {
    if (mode === "view") setHasUnsavedChanges(false);
  }, [mode]);

  const { requestClose, discardDialog } = useDiscardChangesConfirmation({
    active: mode === "create" || mode === "edit",
    hasUnsavedChanges,
  });

  const canEdit = canEditAnyProductFormField(fieldPermissions);

  const initialValues = useMemo(() => {
    if (!detail || !catalogContext) return undefined;
    return {
      ...detailToFormValues(detail),
      storefront_visibility: mergeStorefrontVisibility(
        catalogContext.storefronts,
        detailToFormValues(detail).storefront_visibility
      ),
    };
  }, [catalogContext, detail]);

  const loadEditability = useCallback(() => {
    if (!detail) return;
    startEditabilityTransition(async () => {
      const result = await getItemEditability(detail.id);
      if ("error" in result) {
        toast.error(result.error ?? "Unable to load edit restrictions.");
        setLockedFields([]);
        return;
      }
      setLockedFields(result.editability.locked_fields);
    });
  }, [detail]);

  useEffect(() => {
    if (mode === "edit" && detail && !isVariantCatalogEditMode(mode, detail)) {
      loadEditability();
    }
  }, [detail?.id, loadEditability, mode]);

  const handleEdit = useCallback(() => {
    if (!detail) return;
    blurActiveElement();
    if (detail.detail_scope === "peek") {
      onRequestFullDetail?.();
    }
    if (urlNavigation) {
      urlNavigation.onOpenEdit();
      return;
    }
    onModeChange("edit");
    loadEditability();
  }, [detail, loadEditability, onModeChange, onRequestFullDetail, urlNavigation]);

  const handleCancel = useCallback(() => {
    if (mode === "edit" && detail) {
      setLockedFields([]);
      setHasUnsavedChanges(false);
      if (urlNavigation) {
        urlNavigation.onPeekAfterSave(detail.id);
        return;
      }
      onModeChange("view");
      return;
    }
    onClose();
  }, [detail, mode, onClose, onModeChange, urlNavigation]);

  const handleRequestCancel = useCallback(() => {
    requestClose(handleCancel);
  }, [handleCancel, requestClose]);

  const handleSaved = useCallback(
    (itemId: string, savedDetail?: ProductDetailSnapshot | null) => {
      if (urlNavigation) {
        if (mode === "edit") {
          setLockedFields([]);
        }
        onSaved(itemId, savedDetail);
        return;
      }
      if (mode === "create") {
        onModeChange("edit");
      } else if (mode === "edit") {
        setLockedFields([]);
        onModeChange("view");
      }
      onSaved(itemId, savedDetail);
    },
    [mode, onModeChange, onSaved, urlNavigation]
  );

  const fullPageHref = resolveFullPageHref(mode, detail);

  const onDismiss = useCallback(() => {
    if (mode === "view") {
      blurActiveElement();
      onClose();
      return;
    }
    requestClose(handleCancel);
  }, [handleCancel, mode, onClose, requestClose]);

  const contextValue = useMemo<PanelContextValue>(
    () => ({
      mode,
      detail,
      canEdit,
      isLoadingEditability,
      isDetailRefreshing,
      fullPageHref,
      onEdit: handleEdit,
      onDismiss,
      fieldPermissions,
      mutationHeader,
      setMutationHeader,
      viewLayout,
      setViewLayout,
      onItemArchived,
      catalogContext,
    }),
    [
      mode,
      detail,
      canEdit,
      isLoadingEditability,
      isDetailRefreshing,
      fullPageHref,
      handleEdit,
      onDismiss,
      fieldPermissions,
      mutationHeader,
      viewLayout,
      setViewLayout,
      onItemArchived,
      catalogContext,
    ]
  );

  const variantCatalogEdit = isVariantCatalogEditMode(mode, detail);

  const summaryCategoryTemplates = useMemo(() => {
    if (!detail?.category_id) return [];
    return resolveEffectiveAttributeTemplates(detail.category_id, categories);
  }, [categories, detail?.category_id]);

  const handleVariantCatalogSaved = useCallback(() => {
    if (!detail) return;
    setHasUnsavedChanges(false);
    void onVariantsReload?.();
    handleSaved(detail.id);
  }, [detail, handleSaved, onVariantsReload]);

  const needsCatalogForBody = mode !== "view";
  const awaitingFullDetailForEdit =
    mode === "edit" &&
    detail != null &&
    !isVariantCatalogEditMode(mode, detail) &&
    detail.detail_scope === "peek";

  const body =
    isLoading ||
    isDetailRefreshing ||
    awaitingFullDetailForEdit ||
    (needsCatalogForBody && !catalogContext) ||
    (mode === "view" && !detail) ? (
      <ProductEditorSkeleton />
    ) : mode === "view" && detail && viewLayout === "compact" ? (
      <ProductItemSummaryCard
        detail={detail}
        currency={catalogContext?.base_currency ?? "USD"}
        catalogContext={catalogContext}
        categoryTemplates={summaryCategoryTemplates}
        peekPanel={peekPanel}
        onPeekPanelChange={onPeekPanelChange}
        peekPanelLoading={peekPanelLoading}
        isValuationsLoading={isValuationsLoading}
      />
    ) : variantCatalogEdit && detail ? (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <VariantCatalogEditForm
          detail={detail}
          categories={categories}
          tenantId={tenantId}
          onSaved={handleVariantCatalogSaved}
          onCancel={handleRequestCancel}
          onMutationHeaderChange={setMutationHeader}
          onDirtyChange={setHasUnsavedChanges}
          onMediaChanged={onExtensionsChanged}
        />
      </div>
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
        onCancel={mode === "view" ? handleCancel : handleRequestCancel}
        onSaved={handleSaved}
        onExtensionsChanged={onExtensionsChanged}
        onVariantPatch={onVariantPatch}
        onVariantsReload={onVariantsReload}
        wizard={wizard}
        onMutationHeaderChange={setMutationHeader}
        onDirtyChange={setHasUnsavedChanges}
      />
    );

  return (
    <ProductPanelContext.Provider value={contextValue}>
      <ProductPanelBodyContext.Provider value={body}>{children}</ProductPanelBodyContext.Provider>
      {discardDialog}
    </ProductPanelContext.Provider>
  );
}

const ProductPanelBodyContext = createContext<ReactNode>(null);

export function ProductPanelHeaderActions() {
  const {
    mode,
    detail,
    canEdit,
    isLoadingEditability,
    isDetailRefreshing,
    fullPageHref,
    onEdit,
    onDismiss,
    onItemArchived,
    mutationHeader,
    viewLayout,
    setViewLayout,
  } = useProductPanelContext();

  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [isArchiving, startArchiveTransition] = useTransition();

  const archiveItemLabel =
    detail?.name?.trim() || detail?.sku?.trim() || "this item";

  const handleConfirmArchive = useCallback(() => {
    if (!detail) return;
    startArchiveTransition(async () => {
      const result = await bulkArchiveItems({
        selectAllMatching: false,
        selectedIds: [detail.id],
      });
      if ("error" in result) {
        toast.error(result.error ?? "Unable to delete item.");
        return;
      }
      toast.success("Item deleted.");
      setArchiveDialogOpen(false);
      onItemArchived?.(detail.id);
      onDismiss();
    });
  }, [detail, onDismiss, onItemArchived]);

  if (mutationHeader) {
    if (mutationHeader.variant === "wizard") {
      const {
        isFirst,
        isLast,
        onBack,
        onSkip,
        onPrimary,
        isPending,
        isNavigatePending,
        primaryLabel,
      } = mutationHeader;
      return (
        <>
          {!isFirst ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending || isNavigatePending}
              onClick={onBack}
            >
              Back
            </Button>
          ) : null}
          {!isFirst && !isLast ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={isPending || isNavigatePending}
              onClick={onSkip}
              title="Save and finish later"
            >
              Skip
            </Button>
          ) : null}
          <PanelMutationPrimaryButton
            label={primaryLabel}
            disabled={isPending || isNavigatePending}
            onClick={onPrimary}
          />
        </>
      );
    }

    const { onSave, isPending, isNavigatePending, saveLabel } = mutationHeader;
    return (
      <PanelMutationPrimaryButton
        label={saveLabel}
        disabled={isPending || isNavigatePending}
        onClick={() => void onSave()}
      />
    );
  }

  const showDelete = mode === "view" && detail != null && canEdit;

  return (
    <>
      {isDetailRefreshing ? (
        <Spinner className="h-4 w-4 shrink-0 text-muted-foreground" aria-label="Loading item" />
      ) : null}
      {mode === "view" && detail ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0"
          onClick={() => setViewLayout(nextLayout(viewLayout))}
          aria-label={LAYOUT_META[viewLayout].next}
          title={`${LAYOUT_META[viewLayout].label} — click to ${LAYOUT_META[viewLayout].next.toLowerCase()}`}
        >
          {LAYOUT_META[viewLayout].icon}
        </Button>
      ) : null}
      {mode === "view" && detail && canEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0"
          onClick={onEdit}
          disabled={isLoadingEditability}
          aria-label="Edit item"
          title="Edit"
        >
          <Pencil className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}
      {showDelete ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-9 w-9 shrink-0 p-0 text-muted-foreground hover:text-destructive"
          onClick={() => setArchiveDialogOpen(true)}
          disabled={isArchiving}
          aria-label="Delete item"
          title="Delete item"
        >
          <Trash2 className="h-4 w-4" aria-hidden />
        </Button>
      ) : null}
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="h-9 w-9 shrink-0 p-0"
        aria-label="Open full page"
        title="Open full page"
      >
        <Link href={fullPageHref} prefetch>
          <ExternalLink className="h-4 w-4" aria-hidden />
        </Link>
      </Button>
      {detail ? (
        <ProductItemArchiveAlert
          open={archiveDialogOpen}
          onOpenChange={setArchiveDialogOpen}
          itemLabel={archiveItemLabel}
          isPending={isArchiving}
          onConfirm={() => void handleConfirmArchive()}
        />
      ) : null}
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
  if (detail && isVariantCatalogEditMode(mode, detail)) {
    const variant = selectedSellableVariant(detail);
    if (variant?.sku?.trim()) return `Edit ${variant.sku.trim()}`;
  }
  return detail?.name?.trim() ? detail.name : "Item";
}

export function resolveProductPanelDescription(
  mode: ProductFormMode,
  detail: ProductDetailSnapshot | null
): string | undefined {
  if (mode === "create") return "Create a new product";
  if (detail && isVariantCatalogEditMode(mode, detail)) {
    const productName = detail.name?.trim();
    if (productName) return productName;
  }
  if (detail) {
    const identitySku = resolveDetailIdentitySku(detail).trim();
    if (identitySku) return identitySku;
  }
  return undefined;
}

export function resolveProductPanelImageUrl(
  mode: ProductFormMode,
  detail: ProductDetailSnapshot | null
): string | null {
  if (mode === "create" || !detail) return null;
  return pickPrimaryImagePreviewUrl(detail.media, detail.variant_id, detail.variants);
}
