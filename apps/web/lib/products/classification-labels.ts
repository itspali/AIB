export const ITEM_CLASSIFICATIONS = [
  "PHYSICAL_GOOD",
  "RAW_MATERIAL",
  "WIP_ASSEMBLY",
  "FINISHED_GOOD",
  "KIT_BUNDLE",
  "CONSUMABLE",
  "SERVICE",
] as const;

export type ItemClassification = (typeof ITEM_CLASSIFICATIONS)[number];

const LABELS: Record<ItemClassification, string> = {
  PHYSICAL_GOOD: "Physical good (legacy)",
  RAW_MATERIAL: "Raw Material",
  WIP_ASSEMBLY: "Work In Progress",
  FINISHED_GOOD: "Finished Good",
  KIT_BUNDLE: "Kit / Bundle",
  CONSUMABLE: "Consumable",
  SERVICE: "Service / Overhead",
};

export type ClassificationChoice = {
  value: ItemClassification;
  label: string;
  description: string;
};

/** Labels and guidance for the supply-chain role picker. */
export const CLASSIFICATION_CHOICES: ClassificationChoice[] = [
  {
    value: "RAW_MATERIAL",
    label: "Raw Material",
    description:
      "Purchased inputs used in production or assembly. Often tracked in inventory and consumed on work orders.",
  },
  {
    value: "WIP_ASSEMBLY",
    label: "Work In Progress",
    description:
      "Partially finished goods still in production. Used for WIP reporting; may hold stock while being built.",
  },
  {
    value: "FINISHED_GOOD",
    label: "Finished Good",
    description:
      "Sellable end product ready for customers. The default role for most goods and digital items you ship or deliver.",
  },
  {
    value: "CONSUMABLE",
    label: "Consumable",
    description:
      "Supplies used in operations (packaging, MRO, office) rather than sold as the main product line.",
  },
  {
    value: "KIT_BUNDLE",
    label: "Kit / Bundle",
    description:
      "Sold as one SKU but fulfilled from components. Pair with Bundle / kit in Inventory when stock is tracked.",
  },
  {
    value: "SERVICE",
    label: "Service / Overhead",
    description:
      "Non-stock service or overhead for costing and reporting. Required when item type is Service.",
  },
  {
    value: "PHYSICAL_GOOD",
    label: "Physical good (legacy)",
    description:
      "Deprecated generic goods role. Choose Finished Good, Raw Material, or another role when editing.",
  },
];

const CLASSIFICATION_DESCRIPTIONS: Record<ItemClassification, string> = Object.fromEntries(
  CLASSIFICATION_CHOICES.map((choice) => [choice.value, choice.description])
) as Record<ItemClassification, string>;

/** Classifications shown in create/edit pickers (excludes deprecated values). */
export const ITEM_CLASSIFICATIONS_FOR_PICKER = ITEM_CLASSIFICATIONS.filter(
  (value) => value !== "PHYSICAL_GOOD"
);

export function classificationLabel(value: ItemClassification): string {
  return LABELS[value] ?? value;
}

export function classificationDescription(value: ItemClassification): string {
  return CLASSIFICATION_DESCRIPTIONS[value] ?? "";
}

export function classificationChoice(
  value: ItemClassification
): ClassificationChoice | undefined {
  return CLASSIFICATION_CHOICES.find((choice) => choice.value === value);
}

export function isItemClassification(value: string): value is ItemClassification {
  return (ITEM_CLASSIFICATIONS as readonly string[]).includes(value);
}
