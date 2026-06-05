import type { ItemClassification } from "@/lib/products/classification-labels";
import type { ItemType } from "@/lib/products/item-model";

/** Roles shown in the supply-chain picker for physical goods (no Kit/Bundle). */
const PHYSICAL_SUPPLY_CHAIN_ROLES: readonly ItemClassification[] = [
  "RAW_MATERIAL",
  "WIP_ASSEMBLY",
  "FINISHED_GOOD",
  "CONSUMABLE",
] as const;

const DIGITAL_CLASSIFICATIONS: readonly ItemClassification[] = [
  "FINISHED_GOOD",
  "CONSUMABLE",
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
        return [...PHYSICAL_SUPPLY_CHAIN_ROLES, "PHYSICAL_GOOD"];
      }
      return PHYSICAL_SUPPLY_CHAIN_ROLES;
    }
    case "SERVICE":
      return ["SERVICE"];
    case "DIGITAL":
      return DIGITAL_CLASSIFICATIONS;
    default:
      return PHYSICAL_SUPPLY_CHAIN_ROLES;
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
  if (classification === "KIT_BUNDLE") {
    return false;
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

  if (current === "KIT_BUNDLE") {
    return "FINISHED_GOOD";
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

  if (classification === "KIT_BUNDLE") {
    issues.push({
      path: "classification",
      message: "Kit / bundle is no longer a supply-chain role — use Sold as a set under Composition",
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

  if (isBundle && !["PHYSICAL", "SERVICE", "DIGITAL"].includes(itemType)) {
    issues.push({
      path: "is_bundle",
      message: "Sold as a set is not available for this item type",
    });
  }

  return issues;
}
