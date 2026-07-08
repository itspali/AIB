"use client";

import { useMemo, type Dispatch, type ReactNode, type RefObject, type SetStateAction } from "react";
import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import type { SimilarItem, VariantAssortmentCell } from "@/app/items/actions";
import type { CompositionCommitResult } from "@/components/products/product-editor/composition-editor";
import type {
  VariantMatrixCommitResult,
  VariantMatrixDraftState,
} from "@/components/products/variant-matrix-generator";
import type { VariantAssortmentMatrixHandle } from "@/components/products/variant-assortment-matrix";
import type { VariantOpeningStockMatrixHandle } from "@/components/products/variant-opening-stock-matrix";
import type { ItemCompositionStageModel } from "@/components/items/item-editor/item-composition-stage";
import type { ItemEssentialsStageModel } from "@/components/items/item-editor/item-essentials-stage";
import type { ItemReachStageModel } from "@/components/items/item-editor/item-reach-stage";
import type { ItemVariantsStageModel } from "@/components/items/item-editor/item-variants-stage";
import type { ItemEditorStageBodyProps } from "@/components/items/item-editor/item-editor-stage-body";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import type { ItemClassification } from "@/lib/products/classification-labels";
import type { EditorSectionId } from "@/lib/products/editor-sections";
import type { EditorStageId } from "@/lib/products/editor-stages";
import type { ItemType } from "@/lib/products/item-model";
import type { ItemTaxCodePickerOption } from "@/lib/tax/item-tax-code-picker";
import { shouldLockProductCode, shouldShowVariantsWizardStage } from "@/lib/products/variant-composition";
import type { UomOption } from "@/lib/products/uom-options";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import type {
  ProductCatalogContext,
  ProductMasterFormValues,
  ProductMediaSnapshot,
  ProductTagSnapshot,
  ProductValuationSnapshot,
  ProductVariantSnapshot,
} from "@/lib/products/types";
import type { VariantCompositionMode } from "@/components/products/variant-matrix-generator";

export type UseItemEditorStageModelsInput = {
  renderStageAccordionHeader: (stageId: EditorStageId) => ReactNode;
  sectionVisible: (id: EditorSectionId) => boolean;
  registerSection: (id: EditorSectionId) => (el: HTMLDivElement | null) => void;
  isSectionMounted: (id: EditorSectionId) => boolean;
  isPanelLayout: boolean;
  wizard?: ItemEssentialsStageModel["wizard"];
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
  showSalableAdvanced: boolean;
  setShowSalableAdvanced: (value: boolean | ((prev: boolean) => boolean)) => void;
  showSellingUnitField: boolean;
  sellingUom: string;
  commerceUomOptions: UomOption[];
  variants: ProductVariantSnapshot[];
  priceBookUomCodes: string[];
  isPurchasable: boolean;
  showPurchasableAdvanced: boolean;
  setShowPurchasableAdvanced: (value: boolean | ((prev: boolean) => boolean)) => void;
  showPurchaseUnitField: boolean;
  showPurchaseConversionField: boolean;
  purchaseUom: string;
  purchaseCommerceUomOptions: UomOption[];
  purchaseUnitConversionHint?: string;
  trackInventory: boolean;
  costingMethod: ProductMasterFormValues["costing_method"];
  trackingMode: ProductMasterFormValues["tracking_mode"];
  valuations: ProductValuationSnapshot[];
  name: string;
  showVariantsSection: boolean;
  sellableVariantCount: number;
  categoryTemplates: AttributeTemplateEntry[];
  compositionTemplates: AttributeTemplateEntry[];
  extraSkuOptions: AttributeTemplateEntry[];
  variantAxisKeys: string[];
  suggestedVariantAxisKeys: string[];
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
  variantCompositionMode: VariantCompositionMode;
  variantCommitRef: RefObject<(() => Promise<VariantMatrixCommitResult>) | null>;
  setCompositionDraft: (state: VariantMatrixDraftState | null) => void;
  compositionDeferSave: boolean;
  compositionCommitRef: RefObject<(() => Promise<CompositionCommitResult>) | null>;
  setCompositionSectionDirty: (dirty: boolean) => void;
  onVariantPatch?: (variantId: string, patch: Partial<ProductVariantSnapshot>) => void;
  onVariantsReload?: () => void | Promise<void>;
  tenantId: string;
  media: ProductMediaSnapshot[];
  onExtensionsChanged?: () => void;
  activeWizardStage: EditorStageId | null;
  descriptiveAttributeTemplates: AttributeTemplateEntry[];
  categoryFieldsTitle: string;
  variantAttributes: ProductMasterFormValues["variant_attributes"];
  tagOptions: ProductTagSnapshot[];
  setTagOptions: Dispatch<SetStateAction<ProductTagSnapshot[]>>;
  customFields: ProductMasterFormValues["custom_fields"];
  tagIds: string[];
  storefrontVisibility: ProductMasterFormValues["storefront_visibility"];
  handleCatalogChange: ItemReachStageModel["onCatalogChange"];
  defaultReorderPoint: string;
  hasListedChannels: boolean;
  reachLocationsPersistErrorMessage?: string;
  locationMatrixRef: RefObject<VariantAssortmentMatrixHandle | null>;
  setDraftAssortmentCells: Dispatch<SetStateAction<VariantAssortmentCell[] | null>>;
  reachOpeningPersistErrorMessage?: string;
  reachOpeningPersistErrorAction?: { href: string; label: string };
  openingStockMatrixRef: RefObject<VariantOpeningStockMatrixHandle | null>;
  draftAssortmentCells: VariantAssortmentCell[] | null;
};

/** Builds memoized stage model objects for `ItemEditorStageBody` from shell form state. */
export function useItemEditorStageModels(
  input: UseItemEditorStageModelsInput
): ItemEditorStageBodyProps {
  const {
    renderStageAccordionHeader,
    sectionVisible,
    registerSection,
    isSectionMounted,
    isPanelLayout,
    wizard,
    mode,
    readOnly,
    similarItems,
    nameCheckLoading,
    similarExpanded,
    setSimilarExpanded,
    checkDuplicatesOnNameBlur,
    needsReview,
    register,
    errors,
    setValue,
    watch,
    disableInput,
    isLocked,
    catalogContext,
    categoryOptions,
    isMultiSku,
    variantStrategy,
    isPhysical,
    itemType,
    canSelectSingleSku,
    itemId,
    currentClassification,
    classificationOptions,
    hasComposition,
    isBundle,
    defaultTaxCategory,
    isTaxableCategory,
    itemTaxCodePickerOptions,
    taxCodeId,
    baseUom,
    alternateUoms,
    fieldDisabled,
    lengthCm,
    widthCm,
    heightCm,
    isActive,
    pricingFieldsLocked,
    isSalable,
    showSalableAdvanced,
    setShowSalableAdvanced,
    showSellingUnitField,
    sellingUom,
    commerceUomOptions,
    variants,
    priceBookUomCodes,
    isPurchasable,
    showPurchasableAdvanced,
    setShowPurchasableAdvanced,
    showPurchaseUnitField,
    showPurchaseConversionField,
    purchaseUom,
    purchaseCommerceUomOptions,
    purchaseUnitConversionHint,
    trackInventory,
    costingMethod,
    trackingMode,
    valuations,
    name,
    showVariantsSection,
    sellableVariantCount,
    categoryTemplates,
    compositionTemplates,
    extraSkuOptions,
    variantAxisKeys,
    suggestedVariantAxisKeys,
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
    variantCompositionMode,
    variantCommitRef,
    setCompositionDraft,
    compositionDeferSave,
    compositionCommitRef,
    setCompositionSectionDirty,
    onVariantPatch,
    onVariantsReload,
    tenantId,
    media,
    onExtensionsChanged,
    activeWizardStage,
    descriptiveAttributeTemplates,
    categoryFieldsTitle,
    variantAttributes,
    tagOptions,
    setTagOptions,
    customFields,
    tagIds,
    storefrontVisibility,
    handleCatalogChange,
    defaultReorderPoint,
    hasListedChannels,
    reachLocationsPersistErrorMessage,
    locationMatrixRef,
    setDraftAssortmentCells,
    reachOpeningPersistErrorMessage,
    reachOpeningPersistErrorAction,
    openingStockMatrixRef,
    draftAssortmentCells,
  } = input;

  const essentials = useMemo<ItemEssentialsStageModel>(
    () => ({
      stageAccordionHeader: renderStageAccordionHeader("essentials"),
      sectionVisible,
      registerSection,
      isSectionMounted,
      isPanelLayout,
      wizard,
      mode,
      readOnly,
      similarItems,
      nameCheckLoading,
      similarExpanded,
      setSimilarExpanded,
      checkDuplicatesOnNameBlur,
      needsReview,
      register,
      errors,
      setValue,
      watch,
      disableInput,
      isLocked,
      catalogContext,
      categoryOptions,
      isMultiSku,
      variantStrategy,
      isPhysical,
      itemType,
      canSelectSingleSku,
      itemId,
      currentClassification,
      classificationOptions,
      hasComposition,
      isBundle,
      defaultTaxCategory,
      isTaxableCategory,
      itemTaxCodePickerOptions,
      taxCodeId,
      baseUom,
      alternateUoms,
      fieldDisabled,
      lengthCm,
      widthCm,
      heightCm,
      isActive,
      pricingFieldsLocked,
      isSalable,
      isPurchasable,
      showSalableAdvanced,
      setShowSalableAdvanced,
      showPurchasableAdvanced,
      setShowPurchasableAdvanced,
      showSellingUnitField,
      showPurchaseUnitField,
      showPurchaseConversionField,
      sellingUom,
      purchaseUom,
      commerceUomOptions,
      purchaseCommerceUomOptions,
      purchaseUnitConversionHint,
      variants,
      priceBookUomCodes,
      trackInventory,
      costingMethod,
      trackingMode,
      valuations,
      name,
      categoryTemplates,
      compositionTemplates,
      extraSkuOptions,
      variantAxisKeys,
      suggestedVariantAxisKeys,
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
      onRegisterVariantCommit: (commit) => {
        variantCommitRef.current = commit;
      },
      onCompositionDraftChange: setCompositionDraft,
      onVariantPatch,
      onVariantsReload,
      tenantId,
      media,
      onExtensionsChanged,
      sellableVariantCount,
      productCodeLocked: shouldLockProductCode(variants),
    }),
    [
      renderStageAccordionHeader,
      sectionVisible,
      registerSection,
      isSectionMounted,
      isPanelLayout,
      wizard,
      mode,
      readOnly,
      similarItems,
      nameCheckLoading,
      similarExpanded,
      setSimilarExpanded,
      checkDuplicatesOnNameBlur,
      needsReview,
      register,
      errors,
      setValue,
      watch,
      disableInput,
      isLocked,
      catalogContext,
      categoryOptions,
      isMultiSku,
      variantStrategy,
      isPhysical,
      itemType,
      canSelectSingleSku,
      itemId,
      currentClassification,
      classificationOptions,
      hasComposition,
      isBundle,
      defaultTaxCategory,
      isTaxableCategory,
      itemTaxCodePickerOptions,
      taxCodeId,
      baseUom,
      alternateUoms,
      fieldDisabled,
      lengthCm,
      widthCm,
      heightCm,
      isActive,
      pricingFieldsLocked,
      isSalable,
      isPurchasable,
      showSalableAdvanced,
      setShowSalableAdvanced,
      showPurchasableAdvanced,
      setShowPurchasableAdvanced,
      showSellingUnitField,
      showPurchaseUnitField,
      showPurchaseConversionField,
      sellingUom,
      purchaseUom,
      commerceUomOptions,
      purchaseCommerceUomOptions,
      purchaseUnitConversionHint,
      variants,
      priceBookUomCodes,
      trackInventory,
      costingMethod,
      trackingMode,
      valuations,
      name,
      categoryTemplates,
      compositionTemplates,
      extraSkuOptions,
      variantAxisKeys,
      suggestedVariantAxisKeys,
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
      variantCommitRef,
      setCompositionDraft,
      onVariantPatch,
      onVariantsReload,
      tenantId,
      media,
      onExtensionsChanged,
      sellableVariantCount,
    ]
  );

  const showVariantsWizardStage = shouldShowVariantsWizardStage({
    isMultiSku,
    variantAxisKeys,
    sellableVariantCount,
    variants,
  });

  const variantsModel = useMemo<ItemVariantsStageModel | null>(() => {
    if (!showVariantsWizardStage) return null;
    return {
      stageAccordionHeader: renderStageAccordionHeader("versions"),
      sectionVisible,
      registerSection,
      isPanelLayout,
      isMultiSku,
      itemId,
      variants,
      categoryTemplates: compositionTemplates,
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
      onRegisterVariantCommit: (commit) => {
        variantCommitRef.current = commit;
      },
      onCompositionDraftChange: setCompositionDraft,
      readOnly,
      onVariantPatch,
      onVariantsReload,
      tenantId,
      media,
      onExtensionsChanged,
    };
  }, [
    showVariantsWizardStage,
    renderStageAccordionHeader,
    sectionVisible,
    registerSection,
    isPanelLayout,
    isMultiSku,
    itemId,
    variants,
    compositionTemplates,
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
    variantCommitRef,
    setCompositionDraft,
    readOnly,
    onVariantPatch,
    onVariantsReload,
    tenantId,
    media,
    onExtensionsChanged,
  ]);

  const composition = useMemo<ItemCompositionStageModel | null>(() => {
    if (!itemId || !hasComposition) return null;
    return {
      stageAccordionHeader: renderStageAccordionHeader("composition"),
      sectionVisible,
      registerSection,
      isPanelLayout,
      itemId,
      itemType: itemType as ItemType,
      classification: currentClassification,
      variants,
      isMultiSku,
      currency: catalogContext.base_currency,
      readOnly,
      compositionDeferSave,
      onRegisterCommit: (commit) => {
        compositionCommitRef.current = commit;
      },
      onDirtyChange: setCompositionSectionDirty,
    };
  }, [
    itemId,
    hasComposition,
    renderStageAccordionHeader,
    sectionVisible,
    registerSection,
    isPanelLayout,
    itemType,
    currentClassification,
    variants,
    isMultiSku,
    catalogContext.base_currency,
    readOnly,
    compositionDeferSave,
    compositionCommitRef,
    setCompositionSectionDirty,
  ]);

  const reach = useMemo<ItemReachStageModel | null>(() => {
    if (!itemId) return null;
    return {
      stageAccordionHeader: renderStageAccordionHeader("reach"),
      sectionVisible,
      registerSection,
      isSectionMounted,
      isPanelLayout,
      isMultiSku,
      isPhysical,
      itemId,
      tenantId,
      variants,
      media,
      readOnly,
      fieldDisabled,
      activeWizardStage,
      onExtensionsChanged,
      descriptiveAttributeTemplates,
      categoryFieldsTitle,
      variantAttributes,
      setValue,
      catalogContext,
      tagOptions,
      setTagOptions,
      customFields,
      tagIds,
      storefrontVisibility,
      onCatalogChange: handleCatalogChange,
      trackInventory,
      defaultReorderPoint,
      hasListedChannels,
      reachLocationsPersistErrorMessage,
      locationMatrixRef,
      setDraftAssortmentCells,
      trackingMode,
      reachOpeningPersistErrorMessage,
      reachOpeningPersistErrorAction,
      openingStockMatrixRef,
      purchasePrice,
      standardCost,
      draftAssortmentCells,
      register,
      errors,
      disableInput,
      pricingFieldsLocked,
      isPurchasable,
      showPurchasableAdvanced,
      setShowPurchasableAdvanced,
      showPurchaseUnitField,
      showPurchaseConversionField,
      purchaseUom,
      purchaseCommerceUomOptions,
      purchaseUnitConversionHint,
      baseUom,
      isSalable,
      priceBookUomCodes,
      name,
    };
  }, [
    itemId,
    renderStageAccordionHeader,
    sectionVisible,
    registerSection,
    isSectionMounted,
    isPanelLayout,
    isMultiSku,
    isPhysical,
    tenantId,
    variants,
    media,
    readOnly,
    fieldDisabled,
    activeWizardStage,
    onExtensionsChanged,
    descriptiveAttributeTemplates,
    categoryFieldsTitle,
    variantAttributes,
    setValue,
    catalogContext,
    tagOptions,
    setTagOptions,
    customFields,
    tagIds,
    storefrontVisibility,
    handleCatalogChange,
    trackInventory,
    defaultReorderPoint,
    hasListedChannels,
    reachLocationsPersistErrorMessage,
    locationMatrixRef,
    setDraftAssortmentCells,
    trackingMode,
    reachOpeningPersistErrorMessage,
    reachOpeningPersistErrorAction,
    openingStockMatrixRef,
    purchasePrice,
    standardCost,
    draftAssortmentCells,
    register,
    errors,
    disableInput,
    pricingFieldsLocked,
    isPurchasable,
    showPurchasableAdvanced,
    setShowPurchasableAdvanced,
    showPurchaseUnitField,
    showPurchaseConversionField,
    purchaseUom,
    purchaseCommerceUomOptions,
    purchaseUnitConversionHint,
    baseUom,
    isSalable,
    priceBookUomCodes,
    name,
  ]);

  return useMemo(
    () => ({
      essentials,
      variants: variantsModel,
      composition,
      reach,
    }),
    [essentials, variantsModel, composition, reach]
  );
}
