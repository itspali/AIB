"use client";

import type { Dispatch, ReactNode, RefObject, SetStateAction } from "react";
import type { UseFormSetValue } from "react-hook-form";
import type { VariantAssortmentCell } from "@/app/items/actions";
import { ProductCatalogExtensions } from "@/components/products/product-catalog-extensions";
import { ProductMediaGallery } from "@/components/products/product-media-gallery";
import { VariantAttributeFields } from "@/components/products/variant-attribute-fields";
import {
  VariantAssortmentMatrix,
  type VariantAssortmentMatrixHandle,
} from "@/components/products/variant-assortment-matrix";
import {
  VariantOpeningStockMatrix,
  type VariantOpeningStockMatrixHandle,
} from "@/components/products/variant-opening-stock-matrix";
import { EditorSectionBlock } from "@/components/products/product-editor/editor-form-primitives";
import { fieldHelpText, SubsectionHeading } from "@/components/ui/field-label-info";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import type { EditorSectionId } from "@/lib/products/editor-sections";
import type { EditorStageId } from "@/lib/products/editor-stages";
import {
  CATALOG_REACH_DISTRIBUTION_LOADING,
  CATEGORY_FIELDS_SECTION_HELP,
  CUSTOM_FIELDS_SECTION_HELP,
  CUSTOM_FIELDS_SECTION_LABEL,
  DISCOVERY_TAGS_SECTION_HELP,
  DISCOVERY_TAGS_SECTION_LABEL,
  VISIBILITY_LOCATIONS_HELP,
  VISIBILITY_LOCATIONS_SUBSECTION,
  VISIBILITY_OPENING_STOCK_HELP,
  VISIBILITY_OPENING_STOCK_SERIAL_BLOCKED,
  VISIBILITY_OPENING_STOCK_SUBSECTION,
  VISIBILITY_SECTION_HELP,
  VISIBILITY_SECTION_LABEL,
} from "@/lib/products/product-user-labels";
import { editorCatalogBlockClass } from "@/lib/products/editor-chrome";
import type {
  ProductCatalogContext,
  ProductMasterFormValues,
  ProductMediaSnapshot,
  ProductTagSnapshot,
  ProductVariantSnapshot,
} from "@/lib/products/types";
import { cn } from "@/lib/utils";

export type ItemReachStageModel = {
  stageAccordionHeader: ReactNode;
  sectionVisible: (id: EditorSectionId) => boolean;
  registerSection: (id: EditorSectionId) => (el: HTMLDivElement | null) => void;
  isSectionMounted: (id: EditorSectionId) => boolean;
  isPanelLayout: boolean;
  isMultiSku: boolean;
  isPhysical: boolean;
  itemId: string;
  tenantId: string;
  variants: ProductVariantSnapshot[];
  media: ProductMediaSnapshot[];
  readOnly: boolean;
  fieldDisabled: boolean;
  activeWizardStage: EditorStageId | null;
  onExtensionsChanged?: () => void;
  descriptiveAttributeTemplates: AttributeTemplateEntry[];
  categoryFieldsTitle: string;
  variantAttributes: ProductMasterFormValues["variant_attributes"];
  setValue: UseFormSetValue<ProductMasterFormValues>;
  catalogContext: ProductCatalogContext;
  tagOptions: ProductTagSnapshot[];
  setTagOptions: Dispatch<SetStateAction<ProductTagSnapshot[]>>;
  customFields: ProductMasterFormValues["custom_fields"];
  tagIds: string[];
  storefrontVisibility: ProductMasterFormValues["storefront_visibility"];
  onCatalogChange: (
    key: "custom_fields" | "tag_ids" | "storefront_visibility",
    value:
      | ProductMasterFormValues["custom_fields"]
      | ProductMasterFormValues["tag_ids"]
      | ProductMasterFormValues["storefront_visibility"]
  ) => void;
  trackInventory: boolean;
  defaultReorderPoint: string;
  hasListedChannels: boolean;
  reachLocationsPersistErrorMessage?: string;
  locationMatrixRef: RefObject<VariantAssortmentMatrixHandle | null>;
  setDraftAssortmentCells: Dispatch<SetStateAction<VariantAssortmentCell[] | null>>;
  trackingMode: ProductMasterFormValues["tracking_mode"];
  reachOpeningPersistErrorMessage?: string;
  reachOpeningPersistErrorAction?: { href: string; label: string };
  openingStockMatrixRef: RefObject<VariantOpeningStockMatrixHandle | null>;
  purchasePrice: string;
  standardCost: string;
  draftAssortmentCells: VariantAssortmentCell[] | null;
};

type Props = {
  model: ItemReachStageModel;
};

export function ItemReachStage({ model }: Props) {
  const {
    stageAccordionHeader,
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
    onCatalogChange,
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
  } = model;

  return (
    <>
      {stageAccordionHeader}
            <EditorSectionBlock
              id="media"
              title="Media"
              description="Images shown across storefront, catalog, and documents."
              registerRef={registerSection("media")}
              hidden={!sectionVisible("media")}
              panel={isPanelLayout}
            >
              <ProductMediaGallery
                tenantId={tenantId}
                itemId={itemId}
                variants={variants}
                media={media}
                readOnly={readOnly}
                layout={
                  activeWizardStage === "reach" || (isPanelLayout && isMultiSku)
                    ? "variant-rows"
                    : "scope-select"
                }
                density="compact"
                onChanged={() => onExtensionsChanged?.()}
              />
            </EditorSectionBlock>

          {isPhysical && descriptiveAttributeTemplates.length > 0 ? (
            <EditorSectionBlock
              id="product_attributes"
              title={categoryFieldsTitle}
              description={CATEGORY_FIELDS_SECTION_HELP}
              registerRef={registerSection("product_attributes")}
              hidden={!sectionVisible("product_attributes")}
              panel={isPanelLayout}
            >
              <VariantAttributeFields
                templates={descriptiveAttributeTemplates}
                values={variantAttributes}
                disabled={fieldDisabled}
                emptyMessage="Choose a category with shared product attributes."
                onChange={(key, value) =>
                  setValue(
                    "variant_attributes",
                    { ...variantAttributes, [key]: value },
                    { shouldDirty: true }
                  )
                }
              />
            </EditorSectionBlock>
          ) : null}

          <EditorSectionBlock
            id="custom_fields"
            title={CUSTOM_FIELDS_SECTION_LABEL}
            description={CUSTOM_FIELDS_SECTION_HELP}
            registerRef={registerSection("custom_fields")}
            hidden={!sectionVisible("custom_fields")}
            panel={isPanelLayout}
          >
            <ProductCatalogExtensions
              compact={isPanelLayout}
              blocks={["custom_fields"]}
              catalogContext={{ ...catalogContext, tags: tagOptions }}
              disabled={fieldDisabled}
              values={{
                custom_fields: customFields,
                tag_ids: tagIds,
                storefront_visibility: storefrontVisibility,
              }}
              onChange={onCatalogChange}
            />
          </EditorSectionBlock>

          <EditorSectionBlock
            id="tags"
            title={DISCOVERY_TAGS_SECTION_LABEL}
            description={DISCOVERY_TAGS_SECTION_HELP}
            registerRef={registerSection("tags")}
            hidden={!sectionVisible("tags")}
            panel={isPanelLayout}
          >
            <ProductCatalogExtensions
              compact={isPanelLayout}
              blocks={["tags"]}
              catalogContext={{ ...catalogContext, tags: tagOptions }}
              disabled={fieldDisabled}
              values={{
                custom_fields: customFields,
                tag_ids: tagIds,
                storefront_visibility: storefrontVisibility,
              }}
              onTagsChanged={setTagOptions}
              onChange={onCatalogChange}
            />
          </EditorSectionBlock>

          <EditorSectionBlock
            id="visibility"
            title={VISIBILITY_SECTION_LABEL}
            description={VISIBILITY_SECTION_HELP}
            registerRef={registerSection("visibility")}
            hidden={!sectionVisible("visibility")}
            panel={isPanelLayout}
          >
            <ProductCatalogExtensions
              compact={isPanelLayout}
              blocks={["channels"]}
              catalogContext={{ ...catalogContext, tags: tagOptions }}
              disabled={fieldDisabled}
              values={{
                custom_fields: customFields,
                tag_ids: tagIds,
                storefront_visibility: storefrontVisibility,
              }}
              onChange={onCatalogChange}
            />
            {itemId && variants.length > 0 ? (
              <div className={cn(isPanelLayout ? "mt-3 space-y-3" : "mt-4 space-y-4")}>
                {isSectionMounted("visibility") ? (
                  <>
                    <div className={editorCatalogBlockClass(isPanelLayout)}>
                      <SubsectionHeading
                        title={VISIBILITY_LOCATIONS_SUBSECTION}
                        compact={isPanelLayout}
                        error={reachLocationsPersistErrorMessage}
                        info={fieldHelpText(
                          [
                            VISIBILITY_LOCATIONS_HELP,
                            hasListedChannels
                              ? "Listed channels appear as columns on the right for per-variant listings."
                              : null,
                            trackInventory
                              ? "Reorder inherits the product default from Inventory until you override it here."
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" ")
                        )}
                      />
                      <VariantAssortmentMatrix
                        ref={locationMatrixRef}
                        itemId={itemId}
                        variants={variants}
                        trackInventory={trackInventory}
                        defaultReorderPoint={defaultReorderPoint}
                        deferSaveToParent={!readOnly && !fieldDisabled}
                        storefrontVisibility={storefrontVisibility}
                        persistError={reachLocationsPersistErrorMessage}
                        onAssortmentCellsChange={setDraftAssortmentCells}
                        readOnly={readOnly || fieldDisabled}
                        embedded
                      />
                    </div>
                    {trackInventory ? (
                      <div className={editorCatalogBlockClass(isPanelLayout)}>
                        <SubsectionHeading
                          title={VISIBILITY_OPENING_STOCK_SUBSECTION}
                          compact={isPanelLayout}
                          error={reachOpeningPersistErrorMessage}
                          errorAction={reachOpeningPersistErrorAction}
                          info={fieldHelpText(
                            trackingMode === "NONE"
                              ? VISIBILITY_OPENING_STOCK_HELP
                              : VISIBILITY_OPENING_STOCK_SERIAL_BLOCKED
                          )}
                        />
                        {trackingMode === "NONE" ? (
                          <VariantOpeningStockMatrix
                            ref={openingStockMatrixRef}
                            itemId={itemId}
                            variants={variants}
                            purchasePrice={purchasePrice}
                            standardCost={standardCost}
                            stockedCellsOverride={draftAssortmentCells ?? undefined}
                            persistError={reachOpeningPersistErrorMessage}
                            persistErrorAction={reachOpeningPersistErrorAction}
                            readOnly={readOnly || fieldDisabled}
                            embedded
                          />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            {VISIBILITY_OPENING_STOCK_SERIAL_BLOCKED}
                          </p>
                        )}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {CATALOG_REACH_DISTRIBUTION_LOADING}
                  </p>
                )}
              </div>
            ) : null}
          </EditorSectionBlock>
    </>
  );
}
