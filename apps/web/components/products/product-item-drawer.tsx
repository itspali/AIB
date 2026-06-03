"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ProductPanelBody,
  ProductPanelScope,
  ProductPanelHeaderActions,
  resolveProductPanelDescription,
  resolveProductPanelTitle,
  useProductPanelContext,
} from "@/components/products/product-panel-form";
import { ProductPrimaryImage } from "@/components/products/product-primary-image";
import { RightDrawer } from "@/components/ui/right-drawer";
import type { CategoryRow } from "@/lib/categories/types";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import {
  type ProductCatalogContext,
  type ProductDetailSnapshot,
} from "@/lib/products/types";
import type { DrawerSurface } from "@/lib/layout/module-drawer-url";
import { useProductCreateWizard } from "@/lib/products/use-product-create-wizard";
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
  urlNavigation: UrlNavigation;
  onExtensionsChanged?: () => void;
  onCreatePersisted?: (itemId: string) => void;
  onItemArchived?: (itemId: string) => void;
};

function surfaceToMode(surface: DrawerSurface, persistedCreateId: string | null): ProductFormMode {
  if (surface === "create") {
    return persistedCreateId ? "edit" : "create";
  }
  if (surface === "edit") return "edit";
  return "view";
}

function ProductItemDrawerSheet({
  open,
  title,
  description,
  mode,
  allowBackgroundInteraction,
  imageUrl,
  imageAlt,
}: {
  open: boolean;
  title: string;
  description?: string;
  mode: ProductFormMode;
  allowBackgroundInteraction: boolean;
  imageUrl: string | null;
  imageAlt: string;
}) {
  const { onDismiss } = useProductPanelContext();

  return (
    <RightDrawer
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
      onRequestClose={onDismiss}
      title={title}
      description={description}
      titleLeading={
        mode !== "create" ? (
          <ProductPrimaryImage imageUrl={imageUrl} alt={imageAlt} size="drawer-header" />
        ) : undefined
      }
      headerActions={<ProductPanelHeaderActions />}
      allowBackgroundInteraction={allowBackgroundInteraction}
      scrollable={false}
      showCloseButton
    >
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <ProductPanelBody />
      </div>
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
  urlNavigation,
  onExtensionsChanged,
  onCreatePersisted,
  onItemArchived,
}: Props) {
  const [persistedCreateId, setPersistedCreateId] = useState<string | null>(null);
  const isCreateFlow = surface === "create";
  const wizardHost = useProductCreateWizard({
    active: isCreateFlow,
    variantStrategy: detail?.variant_strategy ?? "SINGLE_SKU",
    onFinished: (itemId) => {
      urlNavigation.onPeekAfterSave(itemId);
      setPersistedCreateId(null);
    },
  });

  useEffect(() => {
    if (!open || surface !== "create") {
      setPersistedCreateId(null);
      wizardHost.resetWizard();
    }
  }, [open, surface, wizardHost.resetWizard]);

  const mode = surfaceToMode(surface, persistedCreateId);
  const allowBackgroundInteraction = surface === "peek";

  const handleSaved = useCallback(
    (itemId: string, savedDetail?: ProductDetailSnapshot | null) => {
      if (isCreateFlow && !persistedCreateId) {
        setPersistedCreateId(itemId);
        onCreatePersisted?.(itemId);
        wizardHost.handleSaved(itemId, savedDetail);
        return;
      }
      if (isCreateFlow && persistedCreateId) {
        wizardHost.handleSaved(itemId, savedDetail);
        return;
      }
      urlNavigation.onPeekAfterSave(itemId, savedDetail);
    },
    [isCreateFlow, onCreatePersisted, persistedCreateId, urlNavigation, wizardHost]
  );

  const handleModeChange = useCallback((_next: ProductFormMode) => {
    /* URL drives mode. */
  }, []);

  const title = resolveProductPanelTitle(mode, detail);
  const description = resolveProductPanelDescription(mode, detail);
  const imageUrl =
    mode === "create" || !detail
      ? null
      : pickPrimaryImagePreviewUrl(detail.media, detail.variant_id);

  if (!open || surface === "closed") return null;

  return (
    <ProductPanelScope
      mode={mode}
      tenantId={tenantId}
      categories={categories}
      catalogContext={catalogContext}
      detail={detail}
      fieldPermissions={fieldPermissions}
      isLoading={isLoading}
      onModeChange={handleModeChange}
      onSaved={handleSaved}
      onExtensionsChanged={onExtensionsChanged}
      onClose={urlNavigation.onClose}
      onItemArchived={onItemArchived}
      urlNavigation={urlNavigation}
      wizard={isCreateFlow ? wizardHost.wizard : undefined}
    >
      <ProductItemDrawerSheet
        open={open}
        title={title}
        description={description}
        mode={mode}
        allowBackgroundInteraction={allowBackgroundInteraction}
        imageUrl={imageUrl}
        imageAlt={title}
      />
    </ProductPanelScope>
  );
}
