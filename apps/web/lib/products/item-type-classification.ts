import type { ItemClassification } from "@/lib/products/classification-labels";
import type { ItemType } from "@/lib/products/item-model";

const PHYSICAL_CLASSIFICATIONS: readonly ItemClassification[] = [
  "RAW_MATERIAL",
  "WIP_ASSEMBLY",
  "FINISHED_GOOD",
  "CONSUMABLE",
  "KIT_BUNDLE",
] as const;

const DIGITAL_CLASSIFICATIONS: readonly ItemClassification[] = [
  "FINISHED_GOOD",
  "CONSUMABLE",
] as const;

const GENERIC_PHYSICAL_CLASSIFICATIONS: readonly ItemClassification[] = [
  "FINISHED_GOOD",
  "PHYSICAL_GOOD",
] as const;

export type ItemTypeClassificationIssue = {
  path: "item_type" | "classification" | "is_bundle";
  message: string;
};

export function classificationsForItemType(
  itemType: ItemType,
  options?: { includeLegacyPhysicalGood?: boolean }
): readonly ItemClassification[] {
  const includeLegacy = options?.includeLegacyPhysicalGood ?? false;

  switch (itemType) {
    case "PHYSICAL": {
      if (includeLegacy) {
        return [...PHYSICAL_CLASSIFICATIONS, "PHYSICAL_GOOD"];
      }
      return PHYSICAL_CLASSIFICATIONS;
    }
    case "SERVICE":
      return ["SERVICE"];
    case "DIGITAL":
      return DIGITAL_CLASSIFICATIONS;
    default:
      return PHYSICAL_CLASSIFICATIONS;
  }
}

export function isClassificationAllowedForItemType(
  itemType: ItemType,
  classification: ItemClassification,
  options?: { allowLegacyPhysicalGood?: boolean }
): boolean {
  if (classification === "PHYSICAL_GOOD") {
    return Boolean(options?.allowLegacyPhysicalGood);
  }
  return classificationsForItemType(itemType, {
    includeLegacyPhysicalGood: options?.allowLegacyPhysicalGood,
  }).includes(classification);
}

export function deriveClassificationOnItemTypeChange(
  itemType: ItemType,
  current: ItemClassification,
  options?: { preserveLegacyPhysicalGood?: boolean }
): ItemClassification {
  if (
    itemType === "PHYSICAL" &&
    current === "PHYSICAL_GOOD" &&
    options?.preserveLegacyPhysicalGood
  ) {
    return current;
  }

  if (isClassificationAllowedForItemType(itemType, current)) {
    return current;
  }

  switch (itemType) {
    case "SERVICE":
      return "SERVICE";
    case "DIGITAL":
      return "FINISHED_GOOD";
    case "PHYSICAL":
    default:
      return "FINISHED_GOOD";
  }
}

export function classificationForBundleEnabled(
  current: ItemClassification
): ItemClassification {
  if (current === "KIT_BUNDLE") return current;
  if (GENERIC_PHYSICAL_CLASSIFICATIONS.includes(current)) {
    return "KIT_BUNDLE";
  }
  return current;
}

export function classificationWhenBundleDisabled(
  current: ItemClassification
): ItemClassification {
  if (current === "KIT_BUNDLE") {
    return "FINISHED_GOOD";
  }
  return current;
}

export function validateItemTypeClassificationPair(
  itemType: ItemType,
  classification: ItemClassification,
  isBundle: boolean,
  options?: { allowLegacyPhysicalGood?: boolean }
): ItemTypeClassificationIssue[] {
  const issues: ItemTypeClassificationIssue[] = [];
  const allowLegacy = options?.allowLegacyPhysicalGood ?? false;

  if (itemType === "SERVICE" && classification !== "SERVICE") {
    issues.push({
      path: "classification",
      message: "Service items must use Service / overhead classification",
    });
  }

  if (itemType !== "SERVICE" && classification === "SERVICE") {
    issues.push({
      path: "classification",
      message: "Service / overhead classification is only for service items",
    });
  }

  if (
    !isClassificationAllowedForItemType(itemType, classification, {
      allowLegacyPhysicalGood: allowLegacy,
    })
  ) {
    issues.push({
      path: "classification",
      message: "This classification is not valid for the selected item type",
    });
  }

  if (classification === "KIT_BUNDLE" && !isBundle) {
    issues.push({
      path: "is_bundle",
      message: "Kit / bundle classification requires the bundle toggle to be enabled",
    });
  }

  if (isBundle && itemType === "PHYSICAL" && classification !== "KIT_BUNDLE") {
    issues.push({
      path: "classification",
      message: "Bundled items must use Kit / bundle classification",
    });
  }

  if (isBundle && itemType !== "PHYSICAL") {
    issues.push({
      path: "is_bundle",
      message: "Only goods items can be marked as a bundle",
    });
  }

  return issues;
}
