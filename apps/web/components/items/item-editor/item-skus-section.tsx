"use client";

import type { UseFormRegister, UseFormSetValue } from "react-hook-form";
import { VariantAxisChipSelector } from "@/components/products/variant-axis-chip-selector";
import { ProductVariantPanel } from "@/components/products/product-variant-panel";
import type {
  VariantMatrixCommitResult,
  VariantMatrixDraftState,
  VariantCompositionMode,
} from "@/components/products/variant-matrix-generator";
import { EditorField } from "@/components/products/product-editor/editor-form-primitives";
import { Input } from "@/components/ui/input";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { ITEM_EDITOR_FIELD_HELP } from "@/lib/products/item-editor-field-help";
import { skuFieldHint, gtinFieldHint } from "@/lib/products/catalog-item-settings";
import {
  shouldComposeVariants,
  shouldLockProductCode,
  shouldLockVariantAxisPicker,
  splitTemplatesByAxis,
} from "@/lib/products/variant-composition";
import { skuMaskCoversAllAxes, suggestSkuMask } from "@/lib/products/sku-mask";
import { editorPanelDividerClass } from "@/lib/products/editor-chrome";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import { AttributeTemplateBuilder } from "@/components/categories/attribute-template-builder";
import { SubsectionHeading, fieldHelpText } from "@/components/ui/field-label-info";
import { finalizeAttributeTemplateRows } from "@/lib/categories/attribute-key";
import {
  categoryOnlyAxisCandidates,
  extraSkuOptionAxisCandidates,
} from "@/lib/products/item-composition-templates";
import {
  ADD_EXTRA_SKU_OPTION_LABEL,
  EXTRA_SKU_OPTIONS_SECTION_HELP,
  EXTRA_SKU_OPTIONS_SECTION_LABEL,
  PRODUCT_CODE_FIELD_LABEL,
  SKUS_SAVE_FIRST_HINT,
  SKUS_SECTION_HELP,
  SKUS_SECTION_HELP_MULTI,
  SKUS_SECTION_HELP_SINGLE,
} from "@/lib/products/product-user-labels";
import type {
  ProductCatalogContext,
  ProductMasterFormValues,
  ProductMediaSnapshot,
  ProductVariantSnapshot,
} from "@/lib/products/types";
import { cn } from "@/lib/utils";

type Props = {
  mode: ProductFormMode;
  readOnly: boolean;
  isPanelLayout: boolean;
  isMultiSku: boolean;
  isPhysical: boolean;
  isSalable: boolean;
  isPurchasable: boolean;
  itemId: string | null;
  catalogContext: ProductCatalogContext;
  categoryTemplates: AttributeTemplateEntry[];
  compositionTemplates: AttributeTemplateEntry[];
  extraSkuOptions: AttributeTemplateEntry[];
  variantAxisKeys: string[];
  suggestedVariantAxisKeys: string[];
  variants: ProductVariantSnapshot[];
  sku: string;
  skuError?: string;
  register: UseFormRegister<ProductMasterFormValues>;
  setValue: UseFormSetValue<ProductMasterFormValues>;
  disableInput: (formField: keyof ProductMasterFormValues | string, lockKey?: string) => boolean;
  skuMask: string;
  sellingPrice: string;
  purchasePrice: string;
  standardCost: string;
  matrixMrpDefault: string;
  hsnSacCode: string;
  supplierId: string | null;
  deadWeightKg: string;
  shippingVolume: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  variantCompositionMode: VariantCompositionMode;
  onRegisterVariantCommit?: (
    commit: (() => Promise<VariantMatrixCommitResult>) | null
  ) => void;
  onCompositionDraftChange?: (state: VariantMatrixDraftState | null) => void;
  onVariantPatch?: (variantId: string, patch: Partial<ProductVariantSnapshot>) => void;
  onVariantsReload?: () => void | Promise<void>;
  tenantId?: string;
  media?: ProductMediaSnapshot[];
  onMediaChanged?: () => void;
  sellableVariantCount: number;
};

export function ItemSkusSection({
  mode,
  readOnly,
  isPanelLayout,
  isMultiSku,
  isPhysical,
  itemId,
  catalogContext,
  categoryTemplates,
  compositionTemplates,
  extraSkuOptions,
  variantAxisKeys,
  suggestedVariantAxisKeys,
  variants,
  sku,
  skuError,
  register,
  setValue,
  disableInput,
  skuMask,
  sellingPrice,
  purchasePrice,
  standardCost,
  matrixMrpDefault,
  hsnSacCode,
  supplierId,
  deadWeightKg,
  shippingVolume,
  lengthCm,
  widthCm,
  heightCm,
  variantCompositionMode,
  onRegisterVariantCommit,
  onCompositionDraftChange,
  onVariantPatch,
  onVariantsReload,
  tenantId,
  media,
  onMediaChanged,
  sellableVariantCount,
}: Props) {
  if (!isPhysical) {
    return (
      <EditorField
        label="SKU"
        htmlFor="sku"
        error={skuError}
        hint={skuFieldHint(catalogContext.catalog_items, mode === "create")}
      >
        <Input
          id="sku"
          disabled={disableInput("sku")}
          className="font-mono"
          {...register("sku")}
        />
      </EditorField>
    );
  }

  const helpText =
    sellableVariantCount >= 2 || isMultiSku
      ? SKUS_SECTION_HELP_MULTI
      : sellableVariantCount === 0 && isMultiSku
        ? SKUS_SECTION_HELP
        : SKUS_SECTION_HELP_SINGLE;

  const composeVariants = shouldComposeVariants({
    isMultiSku,
    compositionMode: variantCompositionMode,
    variantAxisCount: variantAxisKeys.length,
  });

  const variantAxesLocked =
    variantCompositionMode === "live" && shouldLockVariantAxisPicker(variants);

  const productCodeLocked = shouldLockProductCode(variants);

  const showCategoryAxisPicker = categoryOnlyAxisCandidates(categoryTemplates).length > 0;
  const extraAxisCandidates = extraSkuOptionAxisCandidates(extraSkuOptions);
  const showExtraAxisPicker = extraAxisCandidates.length > 0;

  const handleVariantAxisKeysChange = (keys: string[]) => {
    setValue("variant_axes", keys, { shouldDirty: true });
    const axes = splitTemplatesByAxis(compositionTemplates, keys).axes;
    if (!skuMaskCoversAllAxes(skuMask, axes)) {
      setValue("sku_mask", suggestSkuMask(axes), { shouldDirty: true });
    }
  };

  const handleExtraSkuOptionsChange = (rows: AttributeTemplateEntry[]) => {
    const finalized = finalizeAttributeTemplateRows(rows);
    const previousKeys = new Set(extraSkuOptions.map((entry) => entry.key));
    const nextKeys = new Set(finalized.map((entry) => entry.key));
    setValue("extra_sku_options", finalized, { shouldDirty: true });

    const removedKeys = [...previousKeys].filter((key) => !nextKeys.has(key));
    if (removedKeys.length === 0) return;

    const nextAxes = variantAxisKeys.filter((key) => !removedKeys.includes(key));
    if (nextAxes.length !== variantAxisKeys.length) {
      handleVariantAxisKeysChange(nextAxes);
    }
  };

  const handleExtraAxisKeysChange = (extraKeys: string[]) => {
    const categoryKeys = variantAxisKeys.filter((key) =>
      categoryOnlyAxisCandidates(categoryTemplates).some((template) => template.key === key)
    );
    handleVariantAxisKeysChange([...categoryKeys, ...extraKeys]);
  };

  const selectedExtraAxisKeys = variantAxisKeys.filter((key) =>
    extraAxisCandidates.some((template) => template.key === key)
  );

  return (
    <div className={cn("space-y-4", editorPanelDividerClass())}>
      <p className="text-xs text-muted-foreground">{helpText}</p>

      {isMultiSku ? (
        <EditorField
          label={PRODUCT_CODE_FIELD_LABEL}
          htmlFor="sku"
          error={skuError}
          hint={
            productCodeLocked
              ? ITEM_EDITOR_FIELD_HELP.productCodeLocked
              : ITEM_EDITOR_FIELD_HELP.productCodeMultiSku
          }
          locked={productCodeLocked}
        >
          <Input
            id="sku"
            disabled={disableInput("sku") || productCodeLocked}
            className="font-mono"
            {...register("sku")}
          />
        </EditorField>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <EditorField
            label="SKU"
            htmlFor="sku"
            error={skuError}
            hint={skuFieldHint(catalogContext.catalog_items, mode === "create")}
          >
            <Input
              id="sku"
              disabled={disableInput("sku")}
              className="font-mono"
              {...register("sku")}
            />
          </EditorField>
          <EditorField label="GTIN / Barcode" htmlFor="barcode" hint={gtinFieldHint(catalogContext.catalog_items.scan_identifier_policy)}>
            <Input
              id="barcode"
              disabled={disableInput("barcode")}
              className="font-mono"
              {...register("barcode")}
            />
          </EditorField>
        </div>
      )}

      {showCategoryAxisPicker ? (
        <VariantAxisChipSelector
          templates={categoryTemplates}
          axisKeys={variantAxisKeys.filter((key) =>
            categoryOnlyAxisCandidates(categoryTemplates).some((template) => template.key === key)
          )}
          suggestedAxisKeys={suggestedVariantAxisKeys.filter((key) =>
            categoryOnlyAxisCandidates(categoryTemplates).some((template) => template.key === key)
          )}
          disabled={disableInput("variant_axes")}
          locked={readOnly || variantAxesLocked}
          compact={isPanelLayout}
          onChange={(keys) => {
            handleVariantAxisKeysChange([
              ...keys,
              ...selectedExtraAxisKeys,
            ]);
          }}
        />
      ) : null}

      <div className={cn(editorPanelDividerClass(), "space-y-3")}>
        <SubsectionHeading
          title={EXTRA_SKU_OPTIONS_SECTION_LABEL}
          compact={isPanelLayout}
          info={fieldHelpText(EXTRA_SKU_OPTIONS_SECTION_HELP)}
        />
        {!readOnly ? (
          <AttributeTemplateBuilder
            rows={extraSkuOptions}
            onChange={handleExtraSkuOptionsChange}
            showAdvancedOptions
          />
        ) : extraSkuOptions.length > 0 ? (
          <p className="text-xs text-muted-foreground">
            {extraSkuOptions.map((entry) => entry.label).join(", ")}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{ADD_EXTRA_SKU_OPTION_LABEL}</p>
        )}
        {showExtraAxisPicker ? (
          <VariantAxisChipSelector
            templates={extraSkuOptions}
            axisKeys={selectedExtraAxisKeys}
            suggestedAxisKeys={extraAxisCandidates.map((template) => template.key)}
            disabled={disableInput("variant_axes")}
            locked={readOnly || variantAxesLocked}
            compact={isPanelLayout}
            onChange={handleExtraAxisKeysChange}
          />
        ) : null}
      </div>

      {itemId ? (
        <ProductVariantPanel
          itemId={itemId}
          variants={variants}
          categoryTemplates={compositionTemplates}
          variantAxisKeys={variantAxisKeys}
          suggestedVariantAxisKeys={suggestedVariantAxisKeys}
          onVariantAxisKeysChange={handleVariantAxisKeysChange}
          skuMask={skuMask}
          baseSku={sku}
          defaultSellingPrice={sellingPrice}
          defaultPurchasePrice={purchasePrice}
          defaultStandardCost={standardCost}
          defaultMrp={matrixMrpDefault}
          defaultSupplierId={supplierId}
          variantDefaults={{
            price: sellingPrice,
            dead_weight_kg: deadWeightKg,
            volume: shippingVolume,
            length_cm: lengthCm,
            width_cm: widthCm,
            height_cm: heightCm,
          }}
          variantStrategy={
            isMultiSku || (composeVariants && variantAxisKeys.length > 0)
              ? "MULTI_SKU"
              : "SINGLE_SKU"
          }
          defaultShowDimensionColumns={isMultiSku}
          compositionMode={variantCompositionMode}
          onRegisterVariantCommit={onRegisterVariantCommit}
          onCompositionDraftChange={onCompositionDraftChange}
          readOnly={readOnly}
          onVariantPatch={onVariantPatch}
          onVariantsReload={onVariantsReload}
          tenantId={tenantId}
          media={media}
          onMediaChanged={onMediaChanged}
          showAxisPicker={false}
        />
      ) : (
        <p className="rounded-md border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {SKUS_SAVE_FIRST_HINT}
        </p>
      )}
    </div>
  );
}
