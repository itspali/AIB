"use client";

import type { ReactNode } from "react";
import type { UseFormSetValue } from "react-hook-form";
import { EditorSectionBlock } from "@/components/products/product-editor/editor-form-primitives";
import { ProductVariantPanel } from "@/components/products/product-variant-panel";
import type {
  VariantMatrixCommitResult,
  VariantMatrixDraftState,
  VariantCompositionMode,
} from "@/components/products/variant-matrix-generator";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import { VARIANTS_SECTION_LABEL } from "@/lib/products/product-user-labels";
import { computeVolumeCm3FromDimensions } from "@/lib/products/shipping-dimensions";
import type { EditorSectionId } from "@/lib/products/editor-sections";
import type {
  ProductMasterFormValues,
  ProductMediaSnapshot,
  ProductVariantSnapshot,
} from "@/lib/products/types";
import { cn } from "@/lib/utils";

export type ItemVariantsStageModel = {
  stageAccordionHeader: ReactNode;
  sectionVisible: (id: EditorSectionId) => boolean;
  registerSection: (id: EditorSectionId) => (el: HTMLDivElement | null) => void;
  isPanelLayout: boolean;
  isMultiSku: boolean;
  itemId: string;
  variants: ProductVariantSnapshot[];
  categoryTemplates: AttributeTemplateEntry[];
  variantAxisKeys: string[];
  suggestedVariantAxisKeys: string[];
  setValue: UseFormSetValue<ProductMasterFormValues>;
  skuMask: string;
  sku: string;
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
  variantStrategy: ProductMasterFormValues["variant_strategy"];
  isPhysical: boolean;
  variantCompositionMode: VariantCompositionMode;
  onRegisterVariantCommit: (
    commit: (() => Promise<VariantMatrixCommitResult>) | null
  ) => void;
  onCompositionDraftChange: (state: VariantMatrixDraftState | null) => void;
  readOnly: boolean;
  onVariantPatch?: (variantId: string, patch: Partial<ProductVariantSnapshot>) => void;
  onVariantsReload?: () => void | Promise<void>;
  tenantId: string;
  media: ProductMediaSnapshot[];
  onExtensionsChanged?: () => void;
};

type Props = {
  model: ItemVariantsStageModel;
};

export function ItemVariantsStage({ model }: Props) {
  const {
    stageAccordionHeader,
    sectionVisible,
    registerSection,
    isPanelLayout,
    isMultiSku,
    itemId,
    variants,
    categoryTemplates,
    variantAxisKeys,
    suggestedVariantAxisKeys,
    setValue,
    skuMask,
    sku,
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
    variantStrategy,
    isPhysical,
    variantCompositionMode,
    onRegisterVariantCommit,
    onCompositionDraftChange,
    readOnly,
    onVariantPatch,
    onVariantsReload,
    tenantId,
    media,
    onExtensionsChanged,
  } = model;

  return (
    <>
      {stageAccordionHeader}
      <EditorSectionBlock
        id="variants"
        title={VARIANTS_SECTION_LABEL}
        description={
          isPanelLayout
            ? undefined
            : isMultiSku
              ? "Choose what varies, then add or generate sellable variants (SKUs)."
              : "Category attributes and any additional variants for this product."
        }
        registerRef={registerSection("variants")}
        hidden={!sectionVisible("variants")}
        panel={isPanelLayout}
      >
        <div className={cn(isPanelLayout ? "space-y-4" : "space-y-6")}>
          <ProductVariantPanel
            itemId={itemId}
            variants={variants}
            categoryTemplates={categoryTemplates}
            variantAxisKeys={isMultiSku ? variantAxisKeys : undefined}
            suggestedVariantAxisKeys={isMultiSku ? suggestedVariantAxisKeys : undefined}
            onVariantAxisKeysChange={
              isMultiSku
                ? (keys) => setValue("variant_axes", keys, { shouldDirty: true })
                : undefined
            }
            skuMask={skuMask}
            baseSku={sku}
            defaultSellingPrice={sellingPrice}
            defaultPurchasePrice={purchasePrice}
            defaultStandardCost={standardCost}
            defaultMrp={matrixMrpDefault}
            defaultHsn={hsnSacCode}
            defaultSupplierId={supplierId}
            variantDefaults={{
              price: sellingPrice,
              dead_weight_kg: deadWeightKg,
              volume:
                computeVolumeCm3FromDimensions(lengthCm, widthCm, heightCm) || shippingVolume,
              length_cm: lengthCm,
              width_cm: widthCm,
              height_cm: heightCm,
            }}
            variantStrategy={variantStrategy}
            defaultShowDimensionColumns={isPhysical && isMultiSku}
            compositionMode={variantCompositionMode}
            onRegisterVariantCommit={onRegisterVariantCommit}
            onCompositionDraftChange={onCompositionDraftChange}
            readOnly={readOnly}
            onVariantPatch={onVariantPatch}
            onVariantsReload={onVariantsReload}
            tenantId={tenantId}
            media={media}
            onMediaChanged={() => onExtensionsChanged?.()}
          />
        </div>
      </EditorSectionBlock>
    </>
  );
}
