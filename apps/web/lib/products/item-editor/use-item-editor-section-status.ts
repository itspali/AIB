"use client";

import { useCallback, useMemo } from "react";
import type { FieldErrors } from "react-hook-form";
import type { VariantMatrixDraftState } from "@/components/products/variant-matrix-generator";
import {
  EDITOR_FIELD_SECTION,
  type EditorSectionStatus,
  type SectionId,
} from "@/lib/products/item-editor/editor-shell-shared";
import type {
  ProductMasterFormValues,
  ProductMediaSnapshot,
  ProductVariantSnapshot,
} from "@/lib/products/types";

export type UseItemEditorSectionStatusInput = {
  errors: FieldErrors<ProductMasterFormValues>;
  reachLocationsPersistErrorMessage?: string;
  reachOpeningPersistErrorMessage?: string;
  name: string;
  sku: string;
  baseUom: string;
  isSalable: boolean;
  isPurchasable: boolean;
  isPhysical: boolean;
  sellingPrice: string;
  mrp: string;
  purchasePrice: string;
  trackInventory: boolean;
  standardCost: string;
  variants: ProductVariantSnapshot[];
  compositionDraft: VariantMatrixDraftState | null;
  media: ProductMediaSnapshot[];
  variantAttributes: ProductMasterFormValues["variant_attributes"];
  customFields: ProductMasterFormValues["custom_fields"];
  tagIds: string[];
  storefrontVisibility: ProductMasterFormValues["storefront_visibility"];
};

export function useItemEditorSectionStatus(input: UseItemEditorSectionStatusInput) {
  const {
    errors,
    reachLocationsPersistErrorMessage,
    reachOpeningPersistErrorMessage,
    name,
    sku,
    baseUom,
    isSalable,
    isPurchasable,
    isPhysical,
    sellingPrice,
    mrp,
    purchasePrice,
    trackInventory,
    standardCost,
    variants,
    compositionDraft,
    media,
    variantAttributes,
    customFields,
    tagIds,
    storefrontVisibility,
  } = input;

  const sectionErrors = useMemo(() => {
    const map: Record<SectionId, boolean> = {
      overview: false,
      salable: false,
      purchasable: false,
      inventory: false,
      variants: false,
      composite_item: false,
      alternate_uoms: false,
      item_logistics: false,
      quality_inspection: false,
      composition: false,
      media: false,
      product_attributes: false,
      custom_fields: false,
      tags: false,
      visibility: false,
    };
    (Object.keys(errors) as Array<keyof ProductMasterFormValues>).forEach((key) => {
      const section = EDITOR_FIELD_SECTION[key];
      if (section) map[section] = true;
    });
    if (reachLocationsPersistErrorMessage || reachOpeningPersistErrorMessage) {
      map.visibility = true;
    }
    return map;
  }, [errors, reachLocationsPersistErrorMessage, reachOpeningPersistErrorMessage]);

  const sectionStatus = useCallback(
    (id: SectionId): EditorSectionStatus => {
      if (sectionErrors[id]) return "error";
      switch (id) {
        case "overview":
          return name?.trim() && sku?.trim() && baseUom?.trim() ? "complete" : "empty";
        case "salable":
          if (!isSalable) return "empty";
          return Number(sellingPrice) > 0 || Number(mrp) > 0 ? "complete" : "empty";
        case "purchasable":
          if (!isPurchasable) return "empty";
          return Number(purchasePrice) > 0 ? "complete" : "empty";
        case "inventory": {
          if (!isPhysical) return "complete";
          if (!trackInventory) return "empty";
          return Number(standardCost) > 0 ? "complete" : "empty";
        }
        case "variants":
          if (compositionDraft?.includedCount) return "complete";
          return variants.some((variant) => !variant.is_master) ? "complete" : "empty";
        case "composite_item":
          return "empty";
        case "alternate_uoms":
          return "empty";
        case "item_logistics":
          return "empty";
        case "quality_inspection":
          return "empty";
        case "composition":
          return "empty";
        case "media":
          return media.length > 0 ? "complete" : "empty";
        case "product_attributes":
          return Object.values(variantAttributes).some((value) => String(value ?? "").trim())
            ? "complete"
            : "empty";
        case "custom_fields":
          return Array.isArray(customFields) && customFields.length > 0 ? "complete" : "empty";
        case "tags":
          return Array.isArray(tagIds) && tagIds.length > 0 ? "complete" : "empty";
        case "visibility":
          return Array.isArray(storefrontVisibility) &&
            storefrontVisibility.some((entry) => entry.is_visible)
            ? "complete"
            : "empty";
        default:
          return "empty";
      }
    },
    [
      sectionErrors,
      name,
      sku,
      baseUom,
      isSalable,
      isPurchasable,
      isPhysical,
      sellingPrice,
      mrp,
      purchasePrice,
      trackInventory,
      standardCost,
      variants,
      compositionDraft?.includedCount,
      media.length,
      variantAttributes,
      customFields,
      tagIds,
      storefrontVisibility,
    ]
  );

  return { sectionErrors, sectionStatus };
}
