"use client";

import type { ReactNode } from "react";
import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import type { SimilarItem } from "@/app/items/actions";
import { EditorSectionBlock } from "@/components/products/product-editor/editor-form-primitives";
import { ItemEssentialsOverviewFields } from "@/components/items/item-editor/item-essentials-overview-fields";
import type { ItemClassification } from "@/lib/products/classification-labels";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import type {
  ProductCatalogContext,
  ProductMasterFormValues,
  ProductMediaSnapshot,
  ProductValuationSnapshot,
  ProductVariantSnapshot,
} from "@/lib/products/types";
import type { UomOption } from "@/lib/products/uom-options";
import { cn } from "@/lib/utils";
import type { EditorSectionId } from "@/lib/products/editor-sections";
import type { EditorWizardChrome } from "@/components/products/product-editor/product-editor-shell";
import { useEditorGlassSections } from "@/lib/products/editor-chrome";
import type { ItemTaxCodePickerOption } from "@/lib/tax/item-tax-code-picker";
import type { VariantCompositionMode, VariantMatrixCommitResult, VariantMatrixDraftState } from "@/components/products/variant-matrix-generator";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import {
  COMPOSITE_ITEM_SECTION_LABEL,
  ALTERNATE_UNITS_SECTION_LABEL,
  DIMENSIONS_SECTION_LABEL,
  INSPECTION_TESTS_SECTION_DESCRIPTION,
  INSPECTION_TESTS_SECTION_LABEL,
  PRICE_BOOK_SECTION_DESCRIPTION,
  PRICE_BOOK_SECTION_LABEL,
  SKUS_SECTION_DESCRIPTION,
  SKUS_SECTION_LABEL,
} from "@/lib/products/product-user-labels";
import { ItemAlternateUnitsSection } from "@/components/items/item-editor/item-alternate-units-section";
import { ItemCompositeSection } from "@/components/items/item-editor/item-composite-section";
import { ItemDimensionsSection } from "@/components/items/item-editor/item-dimensions-section";
import { ItemPriceBookSection } from "@/components/items/item-editor/item-price-book-section";
import { ItemQualityInspectionSection } from "@/components/items/item-editor/item-quality-inspection-section";
import { ItemSkusSection } from "@/components/items/item-editor/item-skus-section";
import { itemTypeSupportsComposition } from "@/lib/products/composition";
import { ITEM_EDITOR_TOGGLE_HELP } from "@/lib/products/item-editor-field-help";
import { fieldHelpText } from "@/components/ui/field-label-info";

export type ItemEssentialsStageModel = {
  stageAccordionHeader: ReactNode;
  sectionVisible: (id: EditorSectionId) => boolean;
  registerSection: (id: EditorSectionId) => (el: HTMLDivElement | null) => void;
  isSectionMounted: (id: EditorSectionId) => boolean;
  isPanelLayout: boolean;
  wizard?: EditorWizardChrome;
  mode: ProductFormMode;
  readOnly: boolean;
  similarItems: SimilarItem[];
  nameCheckLoading: boolean;
  similarExpanded: boolean;
  setSimilarExpanded: (value: boolean) => void;
  checkDuplicatesOnNameBlur: () => void;
  needsReview: boolean;
  register: UseFormRegister<ProductMasterFormValues>;
  errors: FieldErrors<ProductMasterFormValues>;
  setValue: UseFormSetValue<ProductMasterFormValues>;
  watch: UseFormWatch<ProductMasterFormValues>;
  disableInput: (formField: keyof ProductMasterFormValues | string, lockKey?: string) => boolean;
  isLocked: (field: string) => boolean;
  catalogContext: ProductCatalogContext;
  categoryOptions: { id: string | null; label: string; depth: number }[];
  isMultiSku: boolean;
  variantStrategy: ProductMasterFormValues["variant_strategy"];
  isPhysical: boolean;
  itemType: ProductMasterFormValues["item_type"];
  canSelectSingleSku: boolean;
  itemId: string | null;
  currentClassification: ItemClassification;
  classificationOptions: readonly ItemClassification[];
  hasComposition: boolean;
  isBundle: boolean;
  defaultTaxCategory: ProductMasterFormValues["default_tax_category"];
  isTaxableCategory: boolean;
  itemTaxCodePickerOptions: ItemTaxCodePickerOption[];
  taxCodeId: string | null;
  baseUom: string;
  alternateUoms: ProductMasterFormValues["alternate_uoms"];
  fieldDisabled: boolean;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  isActive: boolean;
  pricingFieldsLocked: boolean;
  isSalable: boolean;
  isPurchasable: boolean;
  showSalableAdvanced: boolean;
  setShowSalableAdvanced: (value: boolean | ((prev: boolean) => boolean)) => void;
  showPurchasableAdvanced: boolean;
  setShowPurchasableAdvanced: (value: boolean | ((prev: boolean) => boolean)) => void;
  showSellingUnitField: boolean;
  showPurchaseUnitField: boolean;
  showPurchaseConversionField: boolean;
  sellingUom: string;
  purchaseUom: string;
  commerceUomOptions: UomOption[];
  purchaseCommerceUomOptions: UomOption[];
  purchaseUnitConversionHint?: string;
  variants: ProductVariantSnapshot[];
  priceBookUomCodes: string[];
  trackInventory: boolean;
  costingMethod: ProductMasterFormValues["costing_method"];
  trackingMode: ProductMasterFormValues["tracking_mode"];
  valuations: ProductValuationSnapshot[];
  name: string;
  categoryTemplates: AttributeTemplateEntry[];
  compositionTemplates: AttributeTemplateEntry[];
  extraSkuOptions: AttributeTemplateEntry[];
  variantAxisKeys: string[];
  suggestedVariantAxisKeys: string[];
  sku: string;
  skuMask: string;
  sellingPrice: string;
  purchasePrice: string;
  standardCost: string;
  matrixMrpDefault: string;
  hsnSacCode: string;
  supplierId: string | null;
  deadWeightKg: string;
  shippingVolume: string;
  variantCompositionMode: VariantCompositionMode;
  onRegisterVariantCommit?: (
    commit: (() => Promise<VariantMatrixCommitResult>) | null
  ) => void;
  onCompositionDraftChange?: (state: VariantMatrixDraftState | null) => void;
  onVariantPatch?: (variantId: string, patch: Partial<ProductVariantSnapshot>) => void;
  onVariantsReload?: () => void | Promise<void>;
  tenantId: string;
  media: ProductMediaSnapshot[];
  onExtensionsChanged?: () => void;
  sellableVariantCount: number;
  productCodeLocked: boolean;
};

type Props = {
  model: ItemEssentialsStageModel;
};

export function ItemEssentialsStage({ model }: Props) {
  const {
    stageAccordionHeader,
    sectionVisible,
    registerSection,
    isSectionMounted,
    isPanelLayout,
    wizard,
    readOnly,
    needsReview,
    isPhysical,
    itemType,
    isBundle,
    baseUom,
    alternateUoms,
    lengthCm,
    widthCm,
    heightCm,
    itemId,
    isMultiSku,
    isSalable,
    isPurchasable,
    categoryTemplates,
    compositionTemplates,
    extraSkuOptions,
    variantAxisKeys,
    suggestedVariantAxisKeys,
    variants,
    sku,
    skuMask,
    sellingPrice,
    purchasePrice,
    standardCost,
    matrixMrpDefault,
    hsnSacCode,
    supplierId,
    deadWeightKg,
    shippingVolume,
    variantCompositionMode,
    onRegisterVariantCommit,
    onCompositionDraftChange,
    onVariantPatch,
    onVariantsReload,
    tenantId,
    media,
    onExtensionsChanged,
    sellableVariantCount,
    trackInventory,
    name,
    fieldDisabled,
    priceBookUomCodes,
    register,
    errors,
    setValue,
    disableInput,
    catalogContext,
    mode,
  } = model;

  const glassSections = useEditorGlassSections();
  const showCompositeItemSection = itemTypeSupportsComposition(itemType);
  const hasGeneratedSku =
    Boolean(itemId) && variants.some((variant) => variant.is_sellable !== false);
  const alertBannerClass = cn(
    "mb-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-950/30",
    isPanelLayout && !glassSections && "mb-3 rounded-md px-3 py-2.5",
    glassSections && "mb-3 border-amber-400/35 bg-amber-50/85 dark:border-amber-500/25 dark:bg-amber-950/25"
  );

  return (
    <>
      {stageAccordionHeader}
      <EditorSectionBlock
        id="overview"
        title="Basics"
        description={
          wizard ? undefined : "Name, role, category, tax, units, and commerce defaults."
        }
        registerRef={registerSection("overview")}
        hidden={!sectionVisible("overview")}
        panel={isPanelLayout}
        hideTitle={Boolean(wizard && isPanelLayout)}
      >
        {needsReview && (
          <div className={alertBannerClass}>
            <p className="font-medium text-amber-800 dark:text-amber-300">Needs review</p>
            <p className="text-xs text-amber-700/80 dark:text-amber-300/70">
              This item was quick-created. Complete the details, then clear the flag.
            </p>
          </div>
        )}

        <ItemEssentialsOverviewFields {...model} />
      </EditorSectionBlock>

      {isPhysical ? (
        <EditorSectionBlock
          id="variants"
          title={SKUS_SECTION_LABEL}
          description={SKUS_SECTION_DESCRIPTION}
          registerRef={registerSection("variants")}
          hidden={!sectionVisible("variants")}
          panel={isPanelLayout}
        >
          <ItemSkusSection
            mode={mode}
            readOnly={readOnly}
            isPanelLayout={isPanelLayout}
            isMultiSku={isMultiSku}
            isPhysical={isPhysical}
            isSalable={isSalable}
            isPurchasable={isPurchasable}
            itemId={itemId}
            catalogContext={catalogContext}
            categoryTemplates={categoryTemplates}
            compositionTemplates={compositionTemplates}
            extraSkuOptions={extraSkuOptions}
            variantAxisKeys={variantAxisKeys}
            suggestedVariantAxisKeys={suggestedVariantAxisKeys}
            variants={variants}
            sku={sku}
            skuError={errors.sku?.message}
            register={register}
            setValue={setValue}
            disableInput={disableInput}
            skuMask={skuMask}
            sellingPrice={sellingPrice}
            purchasePrice={purchasePrice}
            standardCost={standardCost}
            matrixMrpDefault={matrixMrpDefault}
            hsnSacCode={hsnSacCode}
            supplierId={supplierId}
            deadWeightKg={deadWeightKg}
            shippingVolume={shippingVolume}
            lengthCm={lengthCm}
            widthCm={widthCm}
            heightCm={heightCm}
            variantCompositionMode={variantCompositionMode}
            onRegisterVariantCommit={onRegisterVariantCommit}
            onCompositionDraftChange={onCompositionDraftChange}
            onVariantPatch={onVariantPatch}
            onVariantsReload={onVariantsReload}
            tenantId={tenantId}
            media={media}
            onMediaChanged={onExtensionsChanged}
            sellableVariantCount={sellableVariantCount}
          />
        </EditorSectionBlock>
      ) : null}

      {showCompositeItemSection ? (
        <EditorSectionBlock
          id="composite_item"
          title={COMPOSITE_ITEM_SECTION_LABEL}
          headerToggle={{
            label: COMPOSITE_ITEM_SECTION_LABEL,
            info: fieldHelpText(ITEM_EDITOR_TOGGLE_HELP.composition),
            checked: isBundle,
            disabled: disableInput("is_bundle"),
            onCheckedChange: (checked) => setValue("is_bundle", checked, { shouldDirty: true }),
          }}
          registerRef={registerSection("composite_item")}
          hidden={!sectionVisible("composite_item")}
          panel={isPanelLayout}
        >
          <ItemCompositeSection isBundle={isBundle} itemId={itemId} />
        </EditorSectionBlock>
      ) : null}

      <EditorSectionBlock
        id="alternate_uoms"
        title={ALTERNATE_UNITS_SECTION_LABEL}
        registerRef={registerSection("alternate_uoms")}
        hidden={!sectionVisible("alternate_uoms")}
        panel={isPanelLayout}
      >
        <ItemAlternateUnitsSection
          isPanelLayout={isPanelLayout}
          isMultiSku={isMultiSku}
          isPhysical={isPhysical}
          catalogContext={catalogContext}
          baseUom={baseUom}
          alternateUoms={alternateUoms}
          fieldDisabled={fieldDisabled}
          register={register}
          errors={errors}
          setValue={setValue}
          disableInput={disableInput}
        />
      </EditorSectionBlock>

      {isPhysical ? (
        <EditorSectionBlock
          id="item_logistics"
          title={DIMENSIONS_SECTION_LABEL}
          registerRef={registerSection("item_logistics")}
          hidden={!sectionVisible("item_logistics")}
          panel={isPanelLayout}
        >
          <ItemDimensionsSection
            isPanelLayout={isPanelLayout}
            isMultiSku={isMultiSku}
            lengthCm={lengthCm}
            widthCm={widthCm}
            heightCm={heightCm}
            register={register}
            errors={errors}
            disableInput={disableInput}
          />
        </EditorSectionBlock>
      ) : null}

      {hasGeneratedSku ? (
        <EditorSectionBlock
          id="salable"
          title={PRICE_BOOK_SECTION_LABEL}
          description={PRICE_BOOK_SECTION_DESCRIPTION}
          registerRef={registerSection("salable")}
          hidden={!sectionVisible("salable")}
          panel={isPanelLayout}
        >
          <ItemPriceBookSection
            isPanelLayout={isPanelLayout}
            isSalable={isSalable}
            itemId={itemId}
            variants={variants}
            priceBookUomCodes={priceBookUomCodes}
            readOnly={readOnly || disableInput("selling_price")}
            isMounted={isSectionMounted("salable")}
          />
        </EditorSectionBlock>
      ) : null}

      {isPhysical && trackInventory && hasGeneratedSku ? (
        <EditorSectionBlock
          id="quality_inspection"
          title={INSPECTION_TESTS_SECTION_LABEL}
          description={INSPECTION_TESTS_SECTION_DESCRIPTION}
          registerRef={registerSection("quality_inspection")}
          hidden={!sectionVisible("quality_inspection")}
          panel={isPanelLayout}
        >
          <ItemQualityInspectionSection
            itemId={itemId}
            readOnly={readOnly}
            name={name}
          />
        </EditorSectionBlock>
      ) : null}
    </>
  );
}
