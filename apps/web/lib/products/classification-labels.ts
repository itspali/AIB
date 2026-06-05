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
    description: "Materials you buy to make products (fabric, parts, ingredients).",
  },
  {
    value: "WIP_ASSEMBLY",
    label: "Work In Progress",
    description: "Half-finished items still being built in your workshop or factory.",
  },
  {
    value: "FINISHED_GOOD",
    label: "Finished Good",
    description: "Ready-to-sell product. The usual choice for items you ship to customers.",
  },
  {
    value: "CONSUMABLE",
    label: "Consumable",
    description: "Supplies you use internally (packaging, tools, office items), not your main product line.",
  },
  {
    value: "SERVICE",
    label: "Service / Overhead",
    description: "Services or overhead costs. Used when the item type is Service.",
  },
  {
    value: "PHYSICAL_GOOD",
    label: "Physical good (legacy)",
    description: "Old option — pick Finished Good or another role above when you can.",
  },
];

const CLASSIFICATION_DESCRIPTIONS: Record<ItemClassification, string> = Object.fromEntries(
  CLASSIFICATION_CHOICES.map((choice) => [choice.value, choice.description])
) as Record<ItemClassification, string>;

/** Classifications shown in create/edit pickers (excludes deprecated / composition-era values). */
export const ITEM_CLASSIFICATIONS_FOR_PICKER = ITEM_CLASSIFICATIONS.filter(
  (value) => value !== "PHYSICAL_GOOD" && value !== "KIT_BUNDLE"
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
