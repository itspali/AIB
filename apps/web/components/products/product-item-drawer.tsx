"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ProductPanelBody,
  ProductPanelScope,
  ProductPanelFooterActions,
  ProductPanelHeaderActions,
  resolveProductPanelDescription,
  resolveProductPanelTitle,
  useProductPanelContext,
} from "@/components/products/product-panel-form";
import { ItemLifecycleStatusDot } from "@/components/products/item-lifecycle-status-dot";
import { ProductPrimaryImage } from "@/components/products/product-primary-image";
import { resolveItemDetailLifecycleStatus } from "@/lib/products/item-lifecycle-status";
import { RightDrawer } from "@/components/ui/right-drawer";
import type { CategoryRow } from "@/lib/categories/types";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import {
  isDetailVariantSkuContext,
  type ProductCatalogContext,
  type ProductDetailSnapshot,
  type ProductVariantSnapshot,
} from "@/lib/products/types";
import type { DrawerSurface } from "@/lib/layout/module-drawer-url";
import type { DrawerWidthPolicy } from "@/lib/layout/drawer-width-policy";
import type { ProductPeekPanelId } from "@/lib/products/peek-panels";
import { useProductCreateWizard } from "@/lib/products/use-product-create-wizard";
import type { ItemSavedOptions } from "@/lib/products/item-editor/editor-shell-shared";
import { variantsWizardStageFromDetail } from "@/lib/products/variant-composition";
import { pickPrimaryImagePreviewUrl } from "@/lib/products/primary-image";

type UrlNavigation = {
  onOpenEdit: () => void;
  onPeekAfterSave: (itemId: string, detail?: ProductDetailSnapshot | null) => void;
  onClose: () => void;
};

type Props = {
  open: boolean;
  surface: DrawerSurface;
  tenantId: string;
  categories: CategoryRow[];
  catalogContext: ProductCatalogContext | null;
  detail: ProductDetailSnapshot | null;
  fieldPermissions: ProductFieldPermissions;
  isLoading?: boolean;
  isDetailRefreshing?: boolean;
  urlNavigation: UrlNavigation;
  onExtensionsChanged?: () => void;
  onRequestFullDetail?: () => void;
  onVariantPatch?: (variantId: string, patch: Partial<ProductVariantSnapshot>) => void;
  onVariantsReload?: () => void | Promise<void>;
  onCreatePersisted?: (itemId: string, detail?: ProductDetailSnapshot | null) => void;
  /** Keeps catalog detail/variants in sync during the create wizard. */
  onDetailSaved?: (itemId: string, detail?: ProductDetailSnapshot | null) => void;
  onItemArchived?: (itemId: string, mode: "deleted" | "archived") => void;
  peekPanel?: ProductPeekPanelId;
  onPeekPanelChange?: (panel: ProductPeekPanelId) => void;
  peekPanelLoading?: ProductPeekPanelId | null;
  isValuationsLoading?: boolean;
};

function surfaceToMode(surface: DrawerSurface, persistedCreateId: string | null): ProductFormMode {
  if (surface === "create") {
    return persistedCreateId ? "edit" : "create";
  }
  if (surface === "edit") return "edit";
  return "view";
}

/** Item peek, create, and edit share the mutate drawer width (60vw). */
function resolveItemDrawerWidthPolicy(_surface: DrawerSurface): DrawerWidthPolicy {
  return "mutate";
}

function ProductItemDrawerSheet({
  open,
  surface,
  title,
  description,
  mode,
  allowBackgroundInteraction,
  imageUrl,
  imageAlt,
  closeOnEscape,
  showHeaderThumbnail,
}: {
  open: boolean;
  surface: DrawerSurface;
  title: string;
  description?: string;
  mode: ProductFormMode;
  allowBackgroundInteraction: boolean;
  imageUrl: string | null;
  imageAlt: string;
  closeOnEscape: boolean;
  showHeaderThumbnail: boolean;
}) {
  const { onDismiss, fullPageHref, mutationHeader, detail } = useProductPanelContext();
  const lifecycleStatus =
    mode === "view" && detail ? resolveItemDetailLifecycleStatus(detail, null) : null;

  return (
    <RightDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
      onRequestClose={onDismiss}
      title={title}
      description={description}
      titleContent={
        lifecycleStatus ? (
          <h2 className="flex min-w-0 items-center gap-1.5 truncate text-left text-sm font-semibold leading-5 text-foreground">
            <ItemLifecycleStatusDot
              tone={lifecycleStatus.tone}
              label={lifecycleStatus.label}
            />
            <span className="truncate">{title}</span>
          </h2>
        ) : undefined
      }
      titleLeading={
        showHeaderThumbnail ? (
          <ProductPrimaryImage imageUrl={imageUrl} alt={imageAlt} size="drawer-header" />
        ) : undefined
      }
      headerActions={<ProductPanelHeaderActions />}
      footer={mutationHeader ? <ProductPanelFooterActions /> : undefined}
      allowBackgroundInteraction={allowBackgroundInteraction}
      widthPolicy={resolveItemDrawerWidthPolicy(surface)}
      surfaceVariant={surface === "peek" ? "default" : "glass"}
      popOutHref={fullPageHref}
      scrollable={mode === "view"}
      showCloseButton
      closeOnEscape={closeOnEscape}
    >
      {mode === "view" ? (
        <ProductPanelBody />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <ProductPanelBody />
        </div>
      )}
    </RightDrawer>
  );
}

export function ProductItemDrawer({
  open,
  surface,
  tenantId,
  categories,
  catalogContext,
  detail,
  fieldPermissions,
  isLoading = false,
  isDetailRefreshing = false,
  urlNavigation,
  onExtensionsChanged,
  onRequestFullDetail,
  onVariantPatch,
  onVariantsReload,
  onCreatePersisted,
  onDetailSaved,
  onItemArchived,
  peekPanel,
  onPeekPanelChange,
  peekPanelLoading,
  isValuationsLoading = false,
}: Props) {
  const [persistedCreateId, setPersistedCreateId] = useState<string | null>(null);
  const [createWizardDetail, setCreateWizardDetail] = useState<ProductDetailSnapshot | null>(null);
  const effectiveDetail = detail ?? createWizardDetail;
  const isCreateFlow = surface === "create";
  const isVariantEdit =
    surface === "edit" && detail != null && isDetailVariantSkuContext(detail);
  const isEditAccordion = surface === "edit" && !isVariantEdit;
  const isWizardFlow = isCreateFlow || isEditAccordion;
  const wizardHost = useProductCreateWizard({
    active: isWizardFlow,
    layout: isEditAccordion ? "accordion" : "steps",
    variantStrategy: effectiveDetail?.variant_strategy ?? "SINGLE_SKU",
    hasComposition: effectiveDetail?.is_bundle ?? false,
    onFinished: (itemId) => {
      urlNavigation.onPeekAfterSave(itemId);
      setPersistedCreateId(null);
    },
  });

  const resetWizardRef = useRef(wizardHost.resetWizard);
  resetWizardRef.current = wizardHost.resetWizard;
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setPersistedCreateId(null);
      setCreateWizardDetail(null);
      resetWizardRef.current();
      wasOpenRef.current = false;
      return;
    }
    const justOpened = !wasOpenRef.current;
    wasOpenRef.current = true;
    if (justOpened && isWizardFlow) {
      resetWizardRef.current();
    }
  }, [open, isWizardFlow]);

  const mode = surfaceToMode(surface, persistedCreateId);
  const allowBackgroundInteraction = surface === "peek";

  const handleSaved = useCallback(
    (itemId: string, savedDetail?: ProductDetailSnapshot | null, options?: ItemSavedOptions) => {
      if (savedDetail && isCreateFlow) {
        setCreateWizardDetail(savedDetail);
      }
      const isFirstPersist = isCreateFlow && !persistedCreateId;
      const variantsStageApplies =
        savedDetail != null && variantsWizardStageFromDetail(savedDetail);

      if (isCreateFlow && isFirstPersist) {
        setPersistedCreateId(itemId);
        onCreatePersisted?.(itemId, savedDetail);
      }

      if (
        options?.advanceWizard === false &&
        !(isFirstPersist && variantsStageApplies)
      ) {
        onDetailSaved?.(itemId, savedDetail);
        return;
      }

      onDetailSaved?.(itemId, savedDetail);

      if (isWizardFlow && !isEditAccordion) {
        wizardHost.handleSaved(itemId, savedDetail);
        return;
      }
      if (!isWizardFlow) {
        urlNavigation.onPeekAfterSave(itemId, savedDetail);
      }
    },
    [
      isCreateFlow,
      isEditAccordion,
      isWizardFlow,
      onCreatePersisted,
      onDetailSaved,
      persistedCreateId,
      urlNavigation,
      wizardHost,
    ]
  );

  const handleModeChange = useCallback((_next: ProductFormMode) => {
    /* URL drives mode. */
  }, []);

  const title = resolveProductPanelTitle(mode, effectiveDetail);
  const description = resolveProductPanelDescription(mode, effectiveDetail);
  const imageUrl =
    mode === "create" || !effectiveDetail
      ? null
      : pickPrimaryImagePreviewUrl(effectiveDetail.media, effectiveDetail.variant_id, effectiveDetail.variants);

  if (!open || surface === "closed") return null;

  return (
    <ProductPanelScope
      mode={mode}
      tenantId={tenantId}
      categories={categories}
      catalogContext={catalogContext}
      detail={effectiveDetail}
      fieldPermissions={fieldPermissions}
      isLoading={isLoading}
      isDetailRefreshing={isDetailRefreshing}
      onModeChange={handleModeChange}
      onSaved={handleSaved}
      onExtensionsChanged={onExtensionsChanged}
      onRequestFullDetail={onRequestFullDetail}
      onVariantPatch={onVariantPatch}
      onVariantsReload={onVariantsReload}
      onClose={urlNavigation.onClose}
      onItemArchived={onItemArchived}
      urlNavigation={urlNavigation}
      wizard={isWizardFlow ? wizardHost.wizard : undefined}
      peekPanel={peekPanel}
      onPeekPanelChange={onPeekPanelChange}
      peekPanelLoading={peekPanelLoading}
      isValuationsLoading={isValuationsLoading}
    >
      <ProductItemDrawerSheet
        open={open}
        surface={surface}
        title={title}
        description={description}
        mode={mode}
        allowBackgroundInteraction={allowBackgroundInteraction}
        imageUrl={imageUrl}
        imageAlt={title}
        closeOnEscape={!isWizardFlow}
        showHeaderThumbnail={mode === "view" || (mode === "edit" && isVariantEdit)}
      />
    </ProductPanelScope>
  );
}
