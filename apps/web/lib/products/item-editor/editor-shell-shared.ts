import {
  Boxes,
  Layers,
  ListTree,
  Package,
  ShoppingCart,
  Store,
  Tag,
  Tags,
  Wallet,
  Warehouse,
} from "lucide-react";
import { COMPOSITION_SECTION_LABEL } from "@/lib/products/composition";
import {
  CUSTOM_FIELDS_SECTION_LABEL,
  DISCOVERY_TAGS_SECTION_LABEL,
  CATEGORY_FIELDS_SECTION_LABEL,
  SKUS_SECTION_LABEL,
  SKUS_SECTION_SHORT_LABEL,
  VISIBILITY_SECTION_LABEL,
} from "@/lib/products/product-user-labels";
import {
  editorSectionIdsForItem,
  type EditorSectionId,
} from "@/lib/products/editor-sections";
import type { EditorStageId } from "@/lib/products/editor-stages";
import type { ProductMasterFormValues } from "@/lib/products/types";

export type EditorSectionStatus = "error" | "complete" | "empty";
export type SectionId = EditorSectionId;

export const EDITOR_SHELL_SECTIONS = [
  { id: "overview" as const, label: "Basics", shortLabel: "Basics", icon: Package },
  { id: "salable" as const, label: "Salable", shortLabel: "Salable", icon: Wallet },
  { id: "purchasable" as const, label: "Purchasable", shortLabel: "Purchasable", icon: ShoppingCart },
  { id: "inventory" as const, label: "Track inventory", shortLabel: "Inventory", icon: Warehouse },
  {
    id: "variants" as const,
    label: SKUS_SECTION_LABEL,
    shortLabel: SKUS_SECTION_SHORT_LABEL,
    icon: Layers,
  },
  { id: "composition" as const, label: COMPOSITION_SECTION_LABEL, shortLabel: "Set", icon: Boxes },
  { id: "media" as const, label: "Media", shortLabel: "Media", icon: ListTree },
  {
    id: "product_attributes" as const,
    label: CATEGORY_FIELDS_SECTION_LABEL,
    shortLabel: "Category",
    icon: Package,
  },
  {
    id: "custom_fields" as const,
    label: CUSTOM_FIELDS_SECTION_LABEL,
    shortLabel: "Fields",
    icon: Tag,
  },
  {
    id: "tags" as const,
    label: DISCOVERY_TAGS_SECTION_LABEL,
    shortLabel: "Tags",
    icon: Tags,
  },
  {
    id: "visibility" as const,
    label: VISIBILITY_SECTION_LABEL,
    shortLabel: "Visibility",
    icon: Store,
  },
] as const;

export type EditorShellSection = (typeof EDITOR_SHELL_SECTIONS)[number];

export function editorShellSections(
  itemId: string | null | undefined,
  hasComposition: boolean
): EditorShellSection[] {
  const ids = new Set(editorSectionIdsForItem(itemId, { hasComposition }));
  return EDITOR_SHELL_SECTIONS.filter((section) => ids.has(section.id));
}

export function resolveEditorScrollSpyOffset(
  isPanelLayout: boolean,
  stickyNavHeight: number,
  panelRailHorizontal: boolean
): number {
  const baseOffset = isPanelLayout ? 20 : 96;
  if (!isPanelLayout && stickyNavHeight > 0) return baseOffset + stickyNavHeight + 8;
  if (isPanelLayout && panelRailHorizontal && stickyNavHeight > 0) {
    return baseOffset + stickyNavHeight + 8;
  }
  return baseOffset;
}

/** Maps form fields to editor sections for invalid-save scroll targeting. */
export const EDITOR_FIELD_SECTION: Partial<Record<keyof ProductMasterFormValues, SectionId>> = {
  classification: "overview",
  name: "overview",
  sku: "overview",
  item_type: "overview",
  status: "overview",
  description: "overview",
  category_id: "overview",
  variant_strategy: "overview",
  base_unit_of_measure: "overview",
  selling_price: "salable",
  mrp: "salable",
  selling_uom: "salable",
  purchase_uom: "purchasable",
  purchase_uom_conversion: "purchasable",
  purchase_price: "purchasable",
  supplier_id: "purchasable",
  hsn_sac_code: "overview",
  tax_code_id: "overview",
  default_tax_category: "overview",
  is_returnable: "salable",
  is_bundle: "composite_item",
  reorder_point: "inventory",
  standard_cost: "inventory",
  barcode: "alternate_uoms",
  dead_weight_kg: "item_logistics",
  volume: "item_logistics",
  length_cm: "item_logistics",
  width_cm: "item_logistics",
  height_cm: "item_logistics",
  custom_fields: "custom_fields",
  alternate_uoms: "alternate_uoms",
};

/** Optional flags passed to `onSaved` after a wizard/profile save. */
export type ItemSavedOptions = {
  /** When false, stay on the current wizard stage (Essentials create save). Default true. */
  advanceWizard?: boolean;
};

export type EssentialsWizardAdvanceInput = {
  itemId: string | null;
  isDirty: boolean;
  compositionDraftDirty?: boolean;
  compositionSectionDirty?: boolean;
};

/** Whether the create-wizard primary action should advance past Essentials after save/commit. */
export function resolveEssentialsWizardAdvance(input: EssentialsWizardAdvanceInput): boolean {
  if (!input.itemId) return false;
  if (input.compositionDraftDirty || input.compositionSectionDirty) return true;
  if (!input.isDirty) return true;
  return false;
}

/** Essentials create wizard: skip save when profile and variant draft are already clean. */
export function canEssentialsWizardFastAdvance(input: EssentialsWizardAdvanceInput): boolean {
  return Boolean(
    input.itemId &&
      !input.isDirty &&
      !input.compositionDraftDirty &&
      !input.compositionSectionDirty
  );
}

export function essentialsCreatePrimaryLabel(input: {
  /** True during the guided create wizard (step layout), including after the first Essentials save. */
  createEssentialsWizard: boolean;
  activeWizardStage: EditorStageId | null;
  itemId: string | null;
  isDirty: boolean;
  compositionDraftDirty?: boolean;
  submitPending: boolean;
}): string | null {
  if (!input.createEssentialsWizard || input.activeWizardStage !== "essentials") {
    return null;
  }
  if (input.submitPending) return "Saving…";
  if (!input.itemId) return "Save";
  if (input.compositionDraftDirty) {
    return input.isDirty ? "Save & continue" : "Next";
  }
  if (input.isDirty) return "Save";
  return "Next";
}
