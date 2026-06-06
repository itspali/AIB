import type { ItemClassification } from "@/lib/products/classification-labels";
import type { ItemType } from "@/lib/products/item-model";

/** UI label for the composition feature (DB column remains `is_bundle` until renamed). */
export const COMPOSITION_FIELD_LABEL = "Sold as a set";
export const COMPOSITION_STAGE_LABEL = "Composition";
export const COMPOSITION_SECTION_LABEL = "Composition";

export const COMPOSITION_PRICE_MODES = ["FIXED", "COMPLIMENTARY"] as const;
export type CompositionPriceMode = (typeof COMPOSITION_PRICE_MODES)[number];

export type CompositionLineInput = {
  parent_variant_id: string | null;
  component_item_id: string;
  component_variant_id: string | null;
  quantity: number;
  is_mandatory: boolean;
  is_optional_addon: boolean;
  default_selected: boolean;
  unit_price: number;
  price_mode: CompositionPriceMode;
  sort_order: number;
};

export type CompositionLineRow = CompositionLineInput & {
  id: string;
  component_name: string;
  component_item_type: ItemType;
  component_sku: string | null;
};

export type CompositionComponentCandidate = {
  id: string;
  name: string;
  item_type: ItemType;
  classification: ItemClassification;
  default_variant_id: string | null;
  default_sku: string | null;
  default_selling_price: string | null;
};

/**
 * Legacy rows used KIT_BUNDLE as supply-chain role. V2 keeps role and composition separate.
 */
export function normalizeCompositionFromDetail(input: {
  classification: ItemClassification;
  is_bundle: boolean;
}): { classification: ItemClassification; is_bundle: boolean } {
  if (input.classification === "KIT_BUNDLE") {
    return {
      classification: "FINISHED_GOOD",
      is_bundle: true,
    };
  }
  return input;
}

export function itemTypeSupportsComposition(itemType: ItemType): boolean {
  return itemType === "PHYSICAL" || itemType === "SERVICE" || itemType === "DIGITAL";
}

/** Component item types allowed for a parent (supply-chain role + item type). */
export function allowedComponentItemTypes(
  parentItemType: ItemType,
  classification: ItemClassification
): readonly ItemType[] {
  if (parentItemType === "SERVICE") {
    return ["SERVICE", "DIGITAL"] as const;
  }
  if (parentItemType === "DIGITAL") {
    return ["DIGITAL", "SERVICE"] as const;
  }

  switch (classification) {
    case "WIP_ASSEMBLY":
      return ["PHYSICAL"] as const;
    case "FINISHED_GOOD":
      return ["PHYSICAL", "SERVICE", "DIGITAL"] as const;
    default:
      return [] as const;
  }
}

export function compositionRoleAllowsComponents(
  parentItemType: ItemType,
  classification: ItemClassification
): boolean {
  if (!itemTypeSupportsComposition(parentItemType)) {
    return false;
  }
  if (parentItemType === "SERVICE" || parentItemType === "DIGITAL") {
    return true;
  }
  return allowedComponentItemTypes(parentItemType, classification).length > 0;
}

export function compositionPriceModeLabel(mode: CompositionPriceMode): string {
  switch (mode) {
    case "COMPLIMENTARY":
      return "Complimentary";
    case "FIXED":
    default:
      return "Fixed price";
  }
}

export function compositionLineKindLabel(line: {
  is_mandatory: boolean;
  is_optional_addon: boolean;
}): string {
  return line.is_optional_addon ? "Optional add-on" : "Mandatory";
}

/** Short guidance when the composition grid is empty. */
export function compositionEmptyStateMessage(
  parentItemType: ItemType,
  classification: ItemClassification,
  hasItemId: boolean
): string {
  if (!hasItemId) {
    return "Save Essentials first, then add components here.";
  }
  if (parentItemType === "SERVICE") {
    return "Add services or digital items included in this package.";
  }
  if (parentItemType === "DIGITAL") {
    return "Add digital items or services bundled with this offer.";
  }
  if (classification === "WIP_ASSEMBLY") {
    return "Add physical goods that make up this work-in-progress assembly.";
  }
  if (classification === "FINISHED_GOOD") {
    return "Add included items (for example TV + optional extended warranty). Use mandatory for always-included lines and optional for add-ons.";
  }
  return "Change supply-chain role to Finished good or Work in progress, or turn off Sold as a set.";
}

export function shouldClearTrackInventoryWhenCompositionEnabled(
  hasComposition: boolean,
  trackInventory: boolean
): boolean {
  return hasComposition && trackInventory;
}

export function validateCompositionDraftRows(
  rows: Array<Pick<CompositionLineInput, "component_item_id" | "is_mandatory" | "is_optional_addon" | "price_mode" | "unit_price">>
): string | null {
  if (rows.length === 0) return null;

  const mandatoryCount = rows.filter((row) => row.is_mandatory).length;
  if (mandatoryCount < 1) {
    return "Add at least one mandatory component.";
  }

  for (const row of rows) {
    if (!row.component_item_id) {
      return "Every line needs a component item.";
    }
    if (row.is_mandatory === row.is_optional_addon) {
      return "Each line must be mandatory or optional.";
    }
    if (row.price_mode === "FIXED" && row.unit_price < 0) {
      return "Fixed price must be zero or greater.";
    }
  }

  return null;
}
