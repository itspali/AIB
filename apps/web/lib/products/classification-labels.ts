export const ITEM_CLASSIFICATIONS = [
  "PHYSICAL_GOOD",
  "RAW_MATERIAL",
  "WIP_ASSEMBLY",
  "FINISHED_GOOD",
  "KIT_BUNDLE",
  "SERVICE",
] as const;

export type ItemClassification = (typeof ITEM_CLASSIFICATIONS)[number];

const LABELS: Record<ItemClassification, string> = {
  PHYSICAL_GOOD: "Physical Good",
  RAW_MATERIAL: "Raw Material",
  WIP_ASSEMBLY: "WIP Assembly",
  FINISHED_GOOD: "Finished Good",
  KIT_BUNDLE: "Kit / Bundle",
  SERVICE: "Service",
};

export function classificationLabel(value: ItemClassification): string {
  return LABELS[value] ?? value;
}

export function isItemClassification(value: string): value is ItemClassification {
  return (ITEM_CLASSIFICATIONS as readonly string[]).includes(value);
}
