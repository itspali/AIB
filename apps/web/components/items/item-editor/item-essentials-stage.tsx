"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import { Plus } from "lucide-react";
import type { SimilarItem } from "@/app/items/actions";
import {
  EditorCommerceUnitField,
  EditorField,
  EditorSectionAdvanced,
  EditorSectionBlock,
  EditorToggleRow,
} from "@/components/products/product-editor/editor-form-primitives";
import {
  ProductBaseUnitField,
  ProductUnitsSection,
} from "@/components/products/product-units-section";
import { PriceBookEntryEditor } from "@/components/products/price-book-entry-editor";
import { SupplierCatalogEditor } from "@/components/products/supplier-catalog-editor";
import { QcTestTemplateScopePanel } from "@/components/procurement/quality-inspection/qc-test-template-scope-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubsectionHeading } from "@/components/ui/field-label-info";
import {
  ITEM_EDITOR_FIELD_HELP,
  ITEM_EDITOR_TOGGLE_HELP,
  VariantStrategyFieldHelp,
} from "@/lib/products/item-editor-field-help";
import { MRP_PRICE_COLUMN } from "@/lib/products/product-user-labels";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemWithDescription,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  classificationChoice,
  classificationDescription,
  classificationLabel,
  type ItemClassification,
} from "@/lib/products/classification-labels";
import {
  COMPOSITION_FIELD_LABEL,
  itemTypeSupportsComposition,
} from "@/lib/products/composition";
import {
  ITEM_COSTING_METHODS,
  ITEM_TRACKING_MODES,
  ITEM_TYPES,
  itemCostingMethodLabel,
  itemLifecycleStatusFromActive,
  itemTrackingModeLabel,
  itemTypeChoice,
  itemTypeDescription,
  itemTypeLabel,
} from "@/lib/products/item-model";
import { gtinFieldHint, skuFieldHint } from "@/lib/products/catalog-item-settings";
import {
  VARIANT_STRATEGY_FIELD_LABEL,
} from "@/lib/products/product-user-labels";
import {
  VARIANT_STRATEGY_CHOICES,
  variantStrategyLabel,
} from "@/lib/products/variant-strategy";
import {
  isTaxableSupplyCategory,
  TAX_CATEGORY_OPTIONS,
  taxCategoryLabel,
} from "@/lib/products/tax-options";
import type { ItemTaxCodePickerOption } from "@/lib/tax/item-tax-code-picker";
import type { UomOption } from "@/lib/products/uom-options";
import {
  computeVolumeCm3FromDimensions,
  formatCalculatedVolumeInfo,
} from "@/lib/products/shipping-dimensions";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import type {
  ProductCatalogContext,
  ProductMasterFormValues,
  ProductValuationSnapshot,
  ProductVariantSnapshot,
} from "@/lib/products/types";
import type { EditorSectionId } from "@/lib/products/editor-sections";
import type { EditorWizardChrome } from "@/components/products/product-editor/product-editor-shell";
import {
  editorDeferredActionClass,
  editorDimensionsLwhGridClass,
  editorEmptyStateClass,
  editorFieldSpanFullClass,
  editorGridClass,
  editorInsetTableWrapClass,
  editorPanelDividerClass,
  editorReadOnlyFieldClass,
  editorSubsectionClass,
  editorSubsectionHeadingClass,
  editorSwitchSize,
} from "@/lib/products/editor-chrome";
import { cn } from "@/lib/utils";

function formatMoney(amount: string, currency: string): string {
  const parsed = Number(amount);
  if (!amount || !Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(parsed);
}

export type ItemEssentialsStageModel = {
  stageAccordionHeader: ReactNode;
  sectionVisible: (id: EditorSectionId) => boolean;
  registerSection: (id: EditorSectionId) => (el: HTMLDivElement | null) => void;
  isSectionMounted: (id: EditorSectionId) => boolean;
  isPanelLayout: boolean;
  wizard?: EditorWizardChrome;
  mode: ProductFormMode;
  readOnly: boolean;
  duplicates: SimilarItem[];
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
  showBasicsMore: boolean;
  setShowBasicsMore: (value: boolean | ((prev: boolean) => boolean)) => void;
  showBasicsAdvanced: boolean;
  setShowBasicsAdvanced: (value: boolean | ((prev: boolean) => boolean)) => void;
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
    mode,
    readOnly,
    duplicates,
    needsReview,
    register,
    errors,
    setValue,
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
    showBasicsMore,
    setShowBasicsMore,
    showBasicsAdvanced,
    setShowBasicsAdvanced,
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
    watch,
  } = model;

  return (
    <>
      {stageAccordionHeader}
          <EditorSectionBlock
            id="overview"
            title="Basics"
            description={
              wizard
                ? undefined
                : "Start here: name, classification, base unit, tax, and how many variants this product has."
            }
            registerRef={registerSection("overview")}
            hidden={!sectionVisible("overview")}
            panel={isPanelLayout}
          >
            {!readOnly && duplicates.length > 0 && (
              <div
                className={cn(
                  "mb-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-950/30",
                  isPanelLayout && "mb-3 rounded-md px-3 py-2.5"
                )}
              >
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  Possible duplicate{duplicates.length > 1 ? "s" : ""}
                </p>
                <ul className="mt-1.5 space-y-1">
                  {duplicates.map((match) => (
                    <li key={match.id} className="flex items-center justify-between gap-3">
                      <span className="min-w-0 truncate text-amber-800 dark:text-amber-300">
                        {match.name}
                        {match.code ? (
                          <span className="ml-1 font-mono text-xs text-amber-700/70 dark:text-amber-300/60">
                            {match.code}
                          </span>
                        ) : null}
                      </span>
                      <Link
                        href={`/items/${match.id}`}
                        prefetch
                        className="shrink-0 text-xs font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-200"
                      >
                        Open
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {needsReview && (
              <div
                className={cn(
                  "mb-4 rounded-lg border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm dark:border-amber-500/30 dark:bg-amber-950/30",
                  isPanelLayout && "mb-3 rounded-md px-3 py-2.5"
                )}
              >
                <p className="font-medium text-amber-800 dark:text-amber-300">Needs review</p>
                <p className="text-xs text-amber-700/80 dark:text-amber-300/70">
                  This item was quick-created. Complete the details, then clear the flag.
                </p>
              </div>
            )}

            <div className={editorGridClass(isPanelLayout)}>
              <EditorField
                label="Item name"
                htmlFor="name"
                error={errors.name?.message}
                hint={ITEM_EDITOR_FIELD_HELP.itemName}
              >
                <Input id="name" disabled={disableInput("name")} {...register("name")} />
              </EditorField>

              <EditorField
                label={isMultiSku ? "Product code" : "SKU"}
                htmlFor="sku"
                error={errors.sku?.message}
                hint={
                  isMultiSku
                    ? ITEM_EDITOR_FIELD_HELP.productCodeMultiSku
                    : skuFieldHint(catalogContext.catalog_items, mode === "create")
                }
              >
                <Input
                  id="sku"
                  disabled={disableInput("sku")}
                  className="font-mono"
                  {...register("sku")}
                />
              </EditorField>

              <EditorField
                label="Description"
                htmlFor="description"
                error={errors.description?.message}
                full
                hint={ITEM_EDITOR_FIELD_HELP.description}
              >
                <textarea
                  id="description"
                  disabled={disableInput("description")}
                  className="flex w-full text-sm placeholder:text-muted-foreground"
                  {...register("description")}
                />
              </EditorField>

              <EditorField
                label={VARIANT_STRATEGY_FIELD_LABEL}
                hint={ITEM_EDITOR_FIELD_HELP.variantStrategySelect}
                info={<VariantStrategyFieldHelp />}
              >
                {!isPhysical ? (
                  <p className={editorReadOnlyFieldClass(isPanelLayout)}>
                    {variantStrategyLabel(variantStrategy)}
                  </p>
                ) : (
                  <div className="space-y-2">
                    <Select
                      value={variantStrategy}
                      disabled={disableInput("variant_strategy", "variant_strategy")}
                      onValueChange={(value) =>
                        setValue(
                          "variant_strategy",
                          value as ProductMasterFormValues["variant_strategy"],
                          { shouldDirty: true }
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue>{variantStrategyLabel(variantStrategy)}</SelectValue>
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {VARIANT_STRATEGY_CHOICES.map((choice) => (
                          <SelectItemWithDescription
                            key={choice.value}
                            value={choice.value}
                            label={choice.label}
                            description={choice.description}
                            disabled={choice.value === "SINGLE_SKU" && !canSelectSingleSku}
                          />
                        ))}
                      </SelectContent>
                    </Select>
                    {itemId && !canSelectSingleSku ? (
                      <p className="text-xs text-muted-foreground">
                        Remove extra sellable SKUs under Variants before switching back to Single.
                      </p>
                    ) : null}
                  </div>
                )}
              </EditorField>

              <EditorField label="Category" hint={ITEM_EDITOR_FIELD_HELP.category}>
                <Select
                  value={watch("category_id") ?? "none"}
                  disabled={disableInput("category_id")}
                  onValueChange={(value) =>
                    setValue("category_id", value === "none" ? null : value, { shouldDirty: true })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Uncategorized</SelectItem>
                    {categoryOptions.map((option) => (
                      <SelectItem key={option.id!} value={option.id!}>
                        {"â€” ".repeat(option.depth)}
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </EditorField>

              <EditorField
                label="Item type"
                hint={ITEM_EDITOR_FIELD_HELP.itemType}
                locked={isLocked("item_type")}
              >
                  <Select
                    value={itemType}
                    disabled={disableInput("item_type", "item_type")}
                    onValueChange={(value) =>
                      setValue("item_type", value as ProductMasterFormValues["item_type"], {
                        shouldDirty: true,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {ITEM_TYPES.map((value) => {
                        const choice = itemTypeChoice(value);
                        return (
                          <SelectItemWithDescription
                            key={value}
                            value={value}
                            label={choice?.label ?? itemTypeLabel(value)}
                            description={choice?.description ?? itemTypeDescription(value)}
                          />
                        );
                      })}
                    </SelectContent>
                  </Select>
                </EditorField>

                {itemType === "SERVICE" ? (
                  <EditorField
                    label="Supply-chain role"
                    hint={ITEM_EDITOR_FIELD_HELP.classification}
                    locked={isLocked("classification")}
                  >
                    <p className={editorReadOnlyFieldClass(isPanelLayout)}>
                      {classificationLabel("SERVICE")}
                    </p>
                  </EditorField>
                ) : (
                  <EditorField
                    label="Supply-chain role"
                    hint={`${ITEM_EDITOR_FIELD_HELP.classification} ${ITEM_EDITOR_FIELD_HELP.supplyChainRoleSelect}`}
                    locked={isLocked("classification")}
                  >
                    <Select
                      value={currentClassification}
                      disabled={disableInput("classification", "classification")}
                      onValueChange={(value) =>
                        setValue(
                          "classification",
                          value as ProductMasterFormValues["classification"],
                          { shouldDirty: true }
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        {classificationOptions.map((value) => {
                          const choice = classificationChoice(value);
                          return (
                            <SelectItemWithDescription
                              key={value}
                              value={value}
                              label={choice?.label ?? classificationLabel(value)}
                              description={
                                choice?.description ?? classificationDescription(value)
                              }
                            />
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </EditorField>
                )}

                {itemTypeSupportsComposition(itemType) ? (
                  <EditorField
                    label={COMPOSITION_FIELD_LABEL}
                    hint={ITEM_EDITOR_TOGGLE_HELP.composition}
                    full
                  >
                    <div className="flex items-center justify-between gap-4">
                      <p className={editorReadOnlyFieldClass(isPanelLayout)}>
                        {hasComposition
                          ? "Save, then add components in the Composition step."
                          : "Off = a single standalone item."}
                      </p>
                      <Switch
                        size={editorSwitchSize}
                        checked={isBundle}
                        disabled={disableInput("is_bundle")}
                        onCheckedChange={(checked) =>
                          setValue("is_bundle", checked, { shouldDirty: true })
                        }
                        aria-label={COMPOSITION_FIELD_LABEL}
                      />
                    </div>
                  </EditorField>
                ) : null}

              <EditorField
                label="Tax category"
                hint={
                  isTaxableCategory
                    ? ITEM_EDITOR_FIELD_HELP.taxCategoryTaxable
                    : ITEM_EDITOR_FIELD_HELP.taxCategoryNonTaxable
                }
              >
                  <Select
                    value={defaultTaxCategory}
                    disabled={disableInput("default_tax_category")}
                    onValueChange={(value) => {
                      setValue(
                        "default_tax_category",
                        value as ProductMasterFormValues["default_tax_category"],
                        { shouldDirty: true }
                      );
                      if (!isTaxableSupplyCategory(value)) {
                        setValue("hsn_sac_code", "", { shouldDirty: true });
                        setValue("tax_code_id", null, { shouldDirty: true });
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TAX_CATEGORY_OPTIONS.map((value) => (
                        <SelectItem key={value} value={value}>
                          {taxCategoryLabel(value)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </EditorField>

                {isTaxableCategory ? (
                  <EditorField
                    label="Tax rule"
                    hint={
                      itemTaxCodePickerOptions.length > 0
                        ? `${ITEM_EDITOR_FIELD_HELP.taxRule} ${ITEM_EDITOR_FIELD_HELP.taxRuleSelect}`
                        : ITEM_EDITOR_FIELD_HELP.taxRule
                    }
                    info={
                      itemTaxCodePickerOptions.length === 0 ? (
                        <p>{ITEM_EDITOR_FIELD_HELP.taxRuleNoRules}</p>
                      ) : undefined
                    }
                  >
                    <Select
                      value={taxCodeId ?? "none"}
                      disabled={disableInput("tax_code_id")}
                      onValueChange={(value) =>
                        setValue("tax_code_id", value === "none" ? null : value, {
                          shouldDirty: true,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent position="popper" sideOffset={4}>
                        <SelectItemWithDescription
                          value="none"
                          label="No tax rule"
                          description="Taxable item with no rate chosen yet. Pick a rate when you know the product code."
                        />
                        {itemTaxCodePickerOptions.map((code) => (
                          <SelectItemWithDescription
                            key={code.id}
                            value={code.id}
                            label={code.pickerLabel}
                            description={code.pickerDescription}
                          />
                        ))}
                      </SelectContent>
                    </Select>
                  </EditorField>
                ) : null}

                {isTaxableCategory ? (
                  <EditorField
                    label="HSN / SAC code"
                    htmlFor="hsn_sac_code"
                    hint={
                      itemTaxCodePickerOptions.length > 0
                        ? `${ITEM_EDITOR_FIELD_HELP.hsnRequired} ${ITEM_EDITOR_FIELD_HELP.hsnExample}`
                        : `${ITEM_EDITOR_FIELD_HELP.hsnIntro} ${ITEM_EDITOR_FIELD_HELP.hsnExample}`
                    }
                  >
                    <Input
                      id="hsn_sac_code"
                      disabled={disableInput("hsn_sac_code")}
                      className="font-mono"
                      {...register("hsn_sac_code")}
                    />
                  </EditorField>
                ) : null}

              <ProductBaseUnitField
                catalogContext={catalogContext}
                baseUom={baseUom}
                isPhysical={isPhysical}
                stockUnitDisabled={disableInput("base_unit_of_measure", "base_unit_of_measure")}
                stockUnitLocked={isLocked("base_unit_of_measure")}
                onBaseUomChange={(code) =>
                  setValue("base_unit_of_measure", code, { shouldDirty: true })
                }
              />

              <EditorSectionAdvanced
                variant="more"
                open={showBasicsMore}
                onToggle={() => setShowBasicsMore((open) => !open)}
                panel={isPanelLayout}
              >
                {!isMultiSku ? (
                  <EditorField
                    label="GTIN"
                    htmlFor="barcode"
                    error={errors.barcode?.message}
                    hint={gtinFieldHint(catalogContext.catalog_items.scan_identifier_policy)}
                  >
                    <Input
                      id="barcode"
                      disabled={disableInput("barcode")}
                      className="font-mono"
                      {...register("barcode")}
                    />
                  </EditorField>
                ) : (
                  <p className={editorEmptyStateClass(isPanelLayout)}>
                    {ITEM_EDITOR_FIELD_HELP.gtinMultiSku}
                  </p>
                )}
                {isPhysical ? (
                  <div className={cn(isPanelLayout ? "space-y-3" : "space-y-4")}>
                    {isMultiSku ? (
                      <p className={editorEmptyStateClass(isPanelLayout)}>
                        Variants inherit these dimensions until you override them per SKU in
                        Variants.
                      </p>
                    ) : null}
                    <div className={editorGridClass(isPanelLayout)}>
                      <div
                        className={cn(
                          editorFieldSpanFullClass(isPanelLayout),
                          editorDimensionsLwhGridClass()
                        )}
                      >
                        <EditorField
                          label="Length (cm)"
                          htmlFor="length_cm"
                          error={errors.length_cm?.message}
                          hint={ITEM_EDITOR_FIELD_HELP.lengthCm}
                        >
                          <Input
                            id="length_cm"
                            disabled={disableInput("length_cm")}
                            className="text-right font-mono"
                            inputMode="decimal"
                            {...register("length_cm")}
                          />
                        </EditorField>
                        <EditorField
                          label="Width (cm)"
                          htmlFor="width_cm"
                          error={errors.width_cm?.message}
                          hint={ITEM_EDITOR_FIELD_HELP.widthCm}
                        >
                          <Input
                            id="width_cm"
                            disabled={disableInput("width_cm")}
                            className="text-right font-mono"
                            inputMode="decimal"
                            {...register("width_cm")}
                          />
                        </EditorField>
                        <EditorField
                          label="Height (cm)"
                          htmlFor="height_cm"
                          error={errors.height_cm?.message}
                          hint={ITEM_EDITOR_FIELD_HELP.heightCm}
                        >
                          <Input
                            id="height_cm"
                            disabled={disableInput("height_cm")}
                            className="text-right font-mono"
                            inputMode="decimal"
                            {...register("height_cm")}
                          />
                        </EditorField>
                      </div>
                      <EditorField
                        label="Weight (kg)"
                        htmlFor="dead_weight_kg"
                        error={errors.dead_weight_kg?.message}
                        full
                        hint={ITEM_EDITOR_FIELD_HELP.weightShipping}
                      >
                        <Input
                          id="dead_weight_kg"
                          disabled={disableInput("dead_weight_kg")}
                          className="text-right font-mono"
                          inputMode="decimal"
                          {...register("dead_weight_kg")}
                        />
                      </EditorField>
                      <p
                        className={cn(
                          "text-xs text-muted-foreground",
                          editorFieldSpanFullClass(isPanelLayout)
                        )}
                      >
                        {formatCalculatedVolumeInfo(lengthCm, widthCm, heightCm)}
                      </p>
                    </div>
                  </div>
                ) : null}
              </EditorSectionAdvanced>

              <EditorSectionAdvanced
                open={showBasicsAdvanced}
                onToggle={() => setShowBasicsAdvanced((open) => !open)}
                panel={isPanelLayout}
              >
                <ProductUnitsSection
                  catalogContext={catalogContext}
                  baseUom={baseUom}
                  alternateUoms={alternateUoms ?? []}
                  alternatesDisabled={fieldDisabled}
                  onAlternateUomsChange={(rows) =>
                    setValue("alternate_uoms", rows, { shouldDirty: true })
                  }
                />
              </EditorSectionAdvanced>
            </div>

            {(itemId || needsReview) && !(isPanelLayout && itemId) ? (
              <div className={editorSubsectionClass(isPanelLayout)}>
                {itemId ? (
                  <h4 className={editorSubsectionHeadingClass(isPanelLayout)}>Status</h4>
                ) : null}
                <div className={editorGridClass(isPanelLayout)}>
                  {itemId ? (
                    <EditorToggleRow
                      label="Active"
                      description={ITEM_EDITOR_TOGGLE_HELP.active}
                      checked={isActive}
                      disabled={disableInput("is_active")}
                      onCheckedChange={(checked) => {
                        setValue("is_active", checked, { shouldDirty: true });
                        setValue("status", itemLifecycleStatusFromActive(checked), { shouldDirty: true });
                      }}
                    />
                  ) : null}
                  {needsReview ? (
                    <EditorToggleRow
                      label="Needs review"
                      description={ITEM_EDITOR_TOGGLE_HELP.needsReview}
                      checked={needsReview}
                      disabled={disableInput("needs_review")}
                      onCheckedChange={(checked) =>
                        setValue("needs_review", checked, { shouldDirty: true })
                      }
                    />
                  ) : null}
                </div>
              </div>
            ) : null}

          </EditorSectionBlock>

          <EditorSectionBlock
            id="salable"
            title="Salable"
            description="Return policy, rates, price book, and sales unit."
            headerToggle={{
              label: "Salable",
              description: ITEM_EDITOR_TOGGLE_HELP.salable,
              checked: isSalable,
              disabled: disableInput("is_salable"),
              onCheckedChange: (checked) =>
                setValue("is_salable", checked, { shouldDirty: true }),
            }}
            registerRef={registerSection("salable")}
            hidden={!sectionVisible("salable")}
            panel={isPanelLayout}
          >
            {pricingFieldsLocked ? (
              <p className="mb-4 text-sm text-muted-foreground">
                Pricing fields are read-only for your role. Contact your workspace owner to request
                access.
              </p>
            ) : null}

            {isSalable ? (
              <>
                <div className={editorGridClass(isPanelLayout)}>
                  <EditorField
                    label={`Selling rate (${catalogContext.base_currency})`}
                    htmlFor="selling_price"
                    error={errors.selling_price?.message}
                    hint={ITEM_EDITOR_FIELD_HELP.sellingRate}
                  >
                    <Input
                      id="selling_price"
                      disabled={disableInput("selling_price")}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("selling_price")}
                    />
                  </EditorField>
                  <EditorField
                    label={`${MRP_PRICE_COLUMN} (${catalogContext.base_currency})`}
                    htmlFor="mrp"
                    error={errors.mrp?.message}
                    hint={ITEM_EDITOR_FIELD_HELP.mrp}
                  >
                    <Input
                      id="mrp"
                      disabled={disableInput("mrp")}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("mrp")}
                    />
                  </EditorField>
                </div>
                <EditorToggleRow
                  label="Returnable"
                  description={ITEM_EDITOR_TOGGLE_HELP.returnable}
                  checked={watch("is_returnable")}
                  disabled={disableInput("is_returnable")}
                  onCheckedChange={(checked) =>
                    setValue("is_returnable", checked, { shouldDirty: true })
                  }
                />
                {showSellingUnitField ? (
                  <EditorSectionAdvanced
                    open={showSalableAdvanced}
                    onToggle={() => setShowSalableAdvanced((open) => !open)}
                    panel={isPanelLayout}
                  >
                    <EditorCommerceUnitField
                      label="Default sales unit"
                      stockUom={baseUom}
                      value={sellingUom}
                      options={commerceUomOptions}
                      fieldDisabled={disableInput("selling_uom")}
                      onUnitChange={(code) => setValue("selling_uom", code, { shouldDirty: true })}
                      info={ITEM_EDITOR_FIELD_HELP.salesUnit}
                    />
                  </EditorSectionAdvanced>
                ) : null}
              </>
            ) : null}
            {itemId && isSalable ? (
              <div className={editorPanelDividerClass()}>
                {isSectionMounted("salable") ? (
                  <PriceBookEntryEditor
                    itemId={itemId}
                    variants={variants}
                    uomCodes={priceBookUomCodes}
                    readOnly={readOnly || disableInput("selling_price")}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Price book entries load when you open Salable.
                  </p>
                )}
              </div>
            ) : null}
          </EditorSectionBlock>

          <EditorSectionBlock
            id="purchasable"
            title="Purchasable"
            description="Purchase rate and vendor quotes."
            headerToggle={{
              label: "Purchasable",
              description: ITEM_EDITOR_TOGGLE_HELP.purchasable,
              checked: isPurchasable,
              disabled: disableInput("is_purchasable"),
              onCheckedChange: (checked) =>
                setValue("is_purchasable", checked, { shouldDirty: true }),
            }}
            registerRef={registerSection("purchasable")}
            hidden={!sectionVisible("purchasable")}
            panel={isPanelLayout}
          >
            {pricingFieldsLocked ? (
              <p className="mb-4 text-sm text-muted-foreground">
                Pricing fields are read-only for your role. Contact your workspace owner to request
                access.
              </p>
            ) : null}

            {isPurchasable ? (
              <>
                <div className={editorGridClass(isPanelLayout)}>
                  <EditorField
                    label={`Purchase rate (${catalogContext.base_currency})`}
                    htmlFor="purchase_price"
                    error={errors.purchase_price?.message}
                    hint={ITEM_EDITOR_FIELD_HELP.purchaseRate}
                  >
                    <Input
                      id="purchase_price"
                      disabled={disableInput("purchase_price")}
                      className="text-right font-mono"
                      inputMode="decimal"
                      {...register("purchase_price")}
                    />
                  </EditorField>
                </div>
                <div className={editorPanelDividerClass()}>
                  {itemId ? (
                    isSectionMounted("purchasable") ? (
                      <SupplierCatalogEditor
                        embedded
                        itemId={itemId}
                        variants={variants}
                        suppliers={catalogContext.suppliers}
                        readOnly={readOnly || disableInput("purchase_price")}
                      />
                    ) : (
                      <p className="text-xs leading-snug text-muted-foreground">
                        Vendor quotes load when you open Purchasable.
                      </p>
                    )
                  ) : (
                    <div className={editorDeferredActionClass(isPanelLayout)}>
                      <p className="text-xs leading-snug text-muted-foreground">
                        Save the item to add vendor quotes with purchase rate and supplier code.
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 gap-1 px-0 font-medium text-primary hover:bg-transparent hover:text-primary",
                          isPanelLayout ? "text-xs" : "text-sm"
                        )}
                        disabled
                        aria-disabled
                      >
                        <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        Add vendor
                      </Button>
                    </div>
                  )}
                </div>
                {showPurchaseUnitField || showPurchaseConversionField ? (
                  <EditorSectionAdvanced
                    open={showPurchasableAdvanced}
                    onToggle={() => setShowPurchasableAdvanced((open) => !open)}
                    panel={isPanelLayout}
                  >
                    {showPurchaseUnitField ? (
                      <EditorCommerceUnitField
                        label="Default purchase unit"
                        stockUom={baseUom}
                        value={purchaseUom}
                        options={purchaseCommerceUomOptions}
                        fieldDisabled={disableInput("purchase_uom")}
                        onUnitChange={(code) =>
                          setValue("purchase_uom", code, { shouldDirty: true })
                        }
                        conversionHint={purchaseUnitConversionHint}
                        info={ITEM_EDITOR_FIELD_HELP.purchaseUnit}
                      />
                    ) : null}
                    {showPurchaseConversionField ? (
                      <div className={editorGridClass(isPanelLayout)}>
                        <EditorField
                          label="Purchase conversion factor"
                          htmlFor="purchase_uom_conversion"
                          error={errors.purchase_uom_conversion?.message}
                          hint={ITEM_EDITOR_FIELD_HELP.purchaseConversionFactor(baseUom, purchaseUom)}
                        >
                          <Input
                            id="purchase_uom_conversion"
                            disabled={disableInput("purchase_uom_conversion")}
                            className="text-right font-mono"
                            inputMode="decimal"
                            {...register("purchase_uom_conversion")}
                          />
                        </EditorField>
                      </div>
                    ) : null}
                  </EditorSectionAdvanced>
                ) : null}
              </>
            ) : null}
          </EditorSectionBlock>

          {isPhysical ? (
            <EditorSectionBlock
              id="inventory"
              title="Track inventory"
              description="Stock tracking, costing, and live valuation."
              headerToggle={{
                label: "Track inventory",
                description: isLocked("track_inventory")
                  ? ITEM_EDITOR_TOGGLE_HELP.trackInventoryLocked
                  : ITEM_EDITOR_TOGGLE_HELP.trackInventory,
                info: !trackInventory ? ITEM_EDITOR_TOGGLE_HELP.trackInventoryOff : undefined,
                checked: trackInventory,
                disabled: disableInput("track_inventory", "track_inventory"),
                onCheckedChange: (checked) =>
                  setValue("track_inventory", checked, { shouldDirty: true }),
              }}
              registerRef={registerSection("inventory")}
              hidden={!sectionVisible("inventory")}
              panel={isPanelLayout}
            >
              {trackInventory ? (
                  <div className={editorGridClass(isPanelLayout)}>
                    <EditorField
                      label="Reorder point"
                      htmlFor="reorder_point"
                      error={errors.reorder_point?.message}
                      hint={ITEM_EDITOR_FIELD_HELP.reorderPoint}
                    >
                      <Input
                        id="reorder_point"
                        disabled={disableInput("reorder_point")}
                        className="text-right font-mono"
                        inputMode="decimal"
                        {...register("reorder_point")}
                      />
                    </EditorField>
                    <EditorField label="Costing method" hint={ITEM_EDITOR_FIELD_HELP.costingMethod}>
                      <Select
                        value={costingMethod}
                        disabled={disableInput("costing_method")}
                        onValueChange={(value) =>
                          setValue("costing_method", value as ProductMasterFormValues["costing_method"], {
                            shouldDirty: true,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ITEM_COSTING_METHODS.map((value) => (
                            <SelectItem key={value} value={value}>
                              {itemCostingMethodLabel(value)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EditorField>
                    {costingMethod === "STANDARD" ? (
                      <EditorField
                        label={`Standard cost (${catalogContext.base_currency})`}
                        htmlFor="standard_cost"
                        error={errors.standard_cost?.message}
                        hint={ITEM_EDITOR_FIELD_HELP.standardCost}
                      >
                        <Input
                          id="standard_cost"
                          disabled={disableInput("standard_cost")}
                          className="text-right font-mono"
                          inputMode="decimal"
                          {...register("standard_cost")}
                        />
                      </EditorField>
                    ) : null}
                    <EditorField
                      label="Batch / serial tracking"
                      locked={isLocked("tracking_mode")}
                      hint={ITEM_EDITOR_FIELD_HELP.trackingMode}
                    >
                      <Select
                        value={trackingMode}
                        disabled={disableInput("tracking_mode", "tracking_mode")}
                        onValueChange={(value) =>
                          setValue("tracking_mode", value as ProductMasterFormValues["tracking_mode"], {
                            shouldDirty: true,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ITEM_TRACKING_MODES.map((value) => (
                            <SelectItem key={value} value={value}>
                              {itemTrackingModeLabel(value)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </EditorField>
                  </div>
                ) : null}

                {itemId && trackInventory ? (
                  <div className={editorPanelDividerClass()}>
                    <QcTestTemplateScopePanel
                      scopeType="ITEM"
                      scopeReferenceId={itemId}
                      scopeLabel="item"
                      readOnly={readOnly}
                      defaultTemplateName={name}
                    />
                  </div>
                ) : null}

                {trackInventory && valuations.length > 0 ? (
                  <div className={editorPanelDividerClass()}>
                    <SubsectionHeading
                      title="Live inventory valuation (read-only)"
                      compact={isPanelLayout}
                    />
                    <div className={editorInsetTableWrapClass(isPanelLayout)}>
                      <table data-header-tone="subtle" className="table-chrome w-full border-separate border-spacing-0 text-sm">
                        <thead>
                          <tr className="border-b border-border text-left">
                            <th className="p-3 font-medium text-muted-foreground">Location</th>
                            <th className="p-3 font-medium text-muted-foreground">On hand</th>
                            <th className="p-3 font-medium text-muted-foreground">MWAC</th>
                          </tr>
                        </thead>
                        <tbody>
                          {valuations.map((row) => (
                            <tr key={row.location_id} className="border-b border-border last:border-0">
                              <td className="p-3">{row.location_name}</td>
                              <td className="p-3 font-mono">{row.total_quantity_on_hand}</td>
                              <td className="p-3 font-mono">
                                {formatMoney(row.current_average_cost, catalogContext.base_currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
            </EditorSectionBlock>
          ) : null}

    </>
  );
}
