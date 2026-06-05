import type { ItemClassification } from "@/lib/products/classification-labels";
import type { ItemType } from "@/lib/products/item-model";

/** UI label for the composition feature (DB column remains `is_bundle` until renamed). */
export const COMPOSITION_FIELD_LABEL = "Sold as a set";
export const COMPOSITION_STAGE_LABEL = "Composition";
export const COMPOSITION_SECTION_LABEL = "Composition";

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

/** Item types that may use composition in the editor (V1: goods only in UI). */
export function itemTypeSupportsComposition(itemType: ItemType): boolean {
  return itemType === "PHYSICAL";
}

/** Component item types allowed for a parent supply-chain role (V1: goods components only). */
export function allowedComponentItemTypes(
  classification: ItemClassification
): readonly ItemType[] {
  switch (classification) {
    case "WIP_ASSEMBLY":
    case "FINISHED_GOOD":
      return ["PHYSICAL"] as const;
    default:
      return [] as const;
  }
}

export function compositionRoleAllowsComponents(classification: ItemClassification): boolean {
  return allowedComponentItemTypes(classification).length > 0;
}

/** Short guidance under the composition toggle or empty composition stage. */
export function compositionEmptyStateMessage(
  classification: ItemClassification,
  hasItemId: boolean
): string {
  if (!hasItemId) {
    return "Save Essentials first, then add components in the Composition step.";
  }
  if (classification === "WIP_ASSEMBLY") {
    return "Add physical goods that make up this work-in-progress assembly.";
  }
  if (classification === "FINISHED_GOOD") {
    return "Add products included in this set (for example TV + optional warranty). Component lines and pricing arrive in the next release.";
  }
  return "Composition is only used for finished goods and work-in-progress items.";
}

/** Composed sales packages should not track parent stock by default. */
export function shouldClearTrackInventoryWhenCompositionEnabled(
  hasComposition: boolean,
  trackInventory: boolean
): boolean {
  return hasComposition && trackInventory;
}
