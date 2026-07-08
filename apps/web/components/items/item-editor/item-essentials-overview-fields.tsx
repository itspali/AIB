"use client";

import type { FieldErrors, UseFormRegister, UseFormSetValue, UseFormWatch } from "react-hook-form";
import {
  EditorCommerceUnitField,
  EditorField,
  EditorGroupedPanel,
  EditorSectionAdvanced,
  EditorToggleRow,
} from "@/components/products/product-editor/editor-form-primitives";
import {
  ProductBaseUnitField,
} from "@/components/products/product-units-section";
import { Input } from "@/components/ui/input";
import { SubsectionHeading } from "@/components/ui/field-label-info";
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
  ITEM_EDITOR_FIELD_HELP,
  ITEM_EDITOR_TOGGLE_HELP,
} from "@/lib/products/item-editor-field-help";
import {
  MRP_PRICE_COLUMN,
  ESSENTIALS_INVENTORY_MULTI_DESCRIPTION,
  ESSENTIALS_PURCHASABLE_MULTI_DESCRIPTION,
  ESSENTIALS_REORDER_MULTI_HINT,
  ESSENTIALS_SELLABLE_MULTI_DESCRIPTION,
} from "@/lib/products/product-user-labels";
import {
  classificationChoice,
  classificationDescription,
  classificationLabel,
  type ItemClassification,
} from "@/lib/products/classification-labels";
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
  isTaxableSupplyCategory,
  TAX_CATEGORY_OPTIONS,
  taxCategoryLabel,
} from "@/lib/products/tax-options";
import type { ItemTaxCodePickerOption } from "@/lib/tax/item-tax-code-picker";
import type { UomOption } from "@/lib/products/uom-options";
import type { ProductFormMode } from "@/lib/products/use-product-form";
import type {
  ProductCatalogContext,
  ProductMasterFormValues,
  ProductValuationSnapshot,
} from "@/lib/products/types";
import {
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
import type { ItemEssentialsStageModel } from "@/components/items/item-editor/item-essentials-stage";
import { ItemDuplicateNameHint } from "@/components/items/item-editor/item-duplicate-name-hint";
import { Spinner } from "@/components/ui/spinner";

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

export type ItemEssentialsOverviewFieldsProps = Pick<
  ItemEssentialsStageModel,
  | "isPanelLayout"
  | "mode"
  | "readOnly"
  | "needsReview"
  | "register"
  | "errors"
  | "setValue"
  | "watch"
  | "disableInput"
  | "isLocked"
  | "catalogContext"
  | "categoryOptions"
  | "isMultiSku"
  | "productCodeLocked"
  | "isPhysical"
  | "itemType"
  | "itemId"
  | "currentClassification"
  | "classificationOptions"
  | "defaultTaxCategory"
  | "isTaxableCategory"
  | "itemTaxCodePickerOptions"
  | "taxCodeId"
  | "baseUom"
  | "fieldDisabled"
  | "isActive"
  | "pricingFieldsLocked"
  | "isSalable"
  | "isPurchasable"
  | "showSalableAdvanced"
  | "setShowSalableAdvanced"
  | "showPurchasableAdvanced"
  | "setShowPurchasableAdvanced"
  | "showSellingUnitField"
  | "showPurchaseUnitField"
  | "showPurchaseConversionField"
  | "sellingUom"
  | "purchaseUom"
  | "commerceUomOptions"
  | "purchaseCommerceUomOptions"
  | "purchaseUnitConversionHint"
  | "trackInventory"
  | "costingMethod"
  | "trackingMode"
  | "valuations"
  | "itemId"
  | "needsReview"
  | "checkDuplicatesOnNameBlur"
  | "similarItems"
  | "nameCheckLoading"
  | "similarExpanded"
  | "setSimilarExpanded"
>;

export function ItemEssentialsOverviewFields(props: ItemEssentialsOverviewFieldsProps) {
  const {
    isPanelLayout,
    mode,
    readOnly,
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
    productCodeLocked,
    isPhysical,
    itemType,
    itemId,
    currentClassification,
    classificationOptions,
    defaultTaxCategory,
    isTaxableCategory,
    itemTaxCodePickerOptions,
    taxCodeId,
    baseUom,
    fieldDisabled,
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
    trackInventory,
    costingMethod,
    trackingMode,
    valuations,
    checkDuplicatesOnNameBlur,
    similarItems,
    nameCheckLoading,
    similarExpanded,
    setSimilarExpanded,
  } = props;

  const {
    onBlur: onNameBlur,
    ...nameField
  } = register("name");

  return (
    <>
      <div className={editorGridClass(isPanelLayout)}>
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

        <EditorField
          label="Item name"
          htmlFor="name"
          error={errors.name?.message}
          hint={ITEM_EDITOR_FIELD_HELP.itemName}
        >
          <Input
            id="name"
            disabled={disableInput("name")}
            {...nameField}
            onBlur={(event) => {
              onNameBlur(event);
              checkDuplicatesOnNameBlur();
            }}
          />
          {!readOnly && catalogContext.catalog_items.allow_duplicate_item_names ? (
            <ItemDuplicateNameHint
              similarItems={similarItems}
              loading={nameCheckLoading}
              expanded={similarExpanded}
              onToggleExpanded={() => setSimilarExpanded(!similarExpanded)}
            />
          ) : null}
          {!readOnly &&
          !catalogContext.catalog_items.allow_duplicate_item_names &&
          nameCheckLoading ? (
            <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className={isPanelLayout ? "size-3.5" : "size-4"} label="Checking item name" />
              Checking name…
            </div>
          ) : null}
        </EditorField>

        {!isPhysical ? (
          <EditorField
            label={isMultiSku ? "Product code" : "SKU"}
            htmlFor="sku"
            error={errors.sku?.message}
            hint={
              isMultiSku
                ? productCodeLocked
                  ? ITEM_EDITOR_FIELD_HELP.productCodeLocked
                  : ITEM_EDITOR_FIELD_HELP.productCodeMultiSku
                : skuFieldHint(catalogContext.catalog_items, mode === "create")
            }
            locked={isMultiSku && productCodeLocked}
          >
            <Input
              id="sku"
              disabled={disableInput("sku") || (isMultiSku && productCodeLocked)}
              className="font-mono"
              {...register("sku")}
            />
          </EditorField>
        ) : null}

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
                  {"— ".repeat(option.depth)}
                  {option.label}
                </SelectItem>
              ))}
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
                      description={choice?.description ?? classificationDescription(value)}
                    />
                  );
                })}
              </SelectContent>
            </Select>
          </EditorField>
        )}

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
          <>
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
                  <SelectItem value="none">No tax rule</SelectItem>
                  {itemTaxCodePickerOptions.map((code) => (
                    <SelectItem key={code.id} value={code.id}>
                      {code.pickerLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditorField>
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
          </>
        ) : null}
      </div>

      <div className={cn(isPanelLayout ? "mt-3 space-y-3" : "mt-4 space-y-4")}>
        <EditorGroupedPanel
          title="Sellable"
          description={
            isMultiSku
              ? ESSENTIALS_SELLABLE_MULTI_DESCRIPTION
              : "Return policy, rates, and sales unit."
          }
          headerAside={
            <Switch
              size={editorSwitchSize}
              checked={isSalable}
              disabled={disableInput("is_salable")}
              onCheckedChange={(checked) =>
                setValue("is_salable", checked, { shouldDirty: true })
              }
              aria-label="Salable"
            />
          }
        >
          {pricingFieldsLocked ? (
            <p className="text-sm text-muted-foreground">
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
        </EditorGroupedPanel>

        <EditorGroupedPanel
          title="Purchasable"
          description={
            isMultiSku
              ? ESSENTIALS_PURCHASABLE_MULTI_DESCRIPTION
              : "Purchase rate and default purchase unit."
          }
          headerAside={
            <Switch
              size={editorSwitchSize}
              checked={isPurchasable}
              disabled={disableInput("is_purchasable")}
              onCheckedChange={(checked) =>
                setValue("is_purchasable", checked, { shouldDirty: true })
              }
              aria-label="Purchasable"
            />
          }
        >
          {pricingFieldsLocked ? (
            <p className="text-sm text-muted-foreground">
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
          ) : (
            <p className={editorEmptyStateClass(isPanelLayout)}>
              {ITEM_EDITOR_TOGGLE_HELP.purchasable}
            </p>
          )}
        </EditorGroupedPanel>

        {isPhysical ? (
          <EditorGroupedPanel
            title="Inventory"
            description={
              isMultiSku
                ? ESSENTIALS_INVENTORY_MULTI_DESCRIPTION
                : "Stock tracking, costing, and live valuation."
            }
            headerAside={
              <Switch
                size={editorSwitchSize}
                checked={trackInventory}
                disabled={disableInput("track_inventory", "track_inventory")}
                onCheckedChange={(checked) =>
                  setValue("track_inventory", checked, { shouldDirty: true })
                }
                aria-label="Track inventory"
              />
            }
          >
            {trackInventory ? (
              <div className={editorGridClass(isPanelLayout)}>
                {!isMultiSku ? (
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
                ) : (
                  <p
                    className={cn(
                      "text-sm text-muted-foreground",
                      editorFieldSpanFullClass(isPanelLayout)
                    )}
                  >
                    {ESSENTIALS_REORDER_MULTI_HINT}
                  </p>
                )}
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

            {trackInventory && valuations.length > 0 ? (
              <div className={editorPanelDividerClass()}>
                <SubsectionHeading
                  title="Live inventory valuation (read-only)"
                  compact={isPanelLayout}
                />
                <div className={editorInsetTableWrapClass(isPanelLayout)}>
                  <table
                    data-header-tone="subtle"
                    className="table-chrome w-full border-separate border-spacing-0 text-sm"
                  >
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
          </EditorGroupedPanel>
        ) : null}
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
    </>
  );
}
