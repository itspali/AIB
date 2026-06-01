// Mirrors the Postgres enums introduced in 20260542000000_item_model_foundation.

export const ITEM_TYPES = ["PHYSICAL", "SERVICE", "DIGITAL"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

export const ITEM_STATUSES = ["DRAFT", "ACTIVE", "DISCONTINUED", "ARCHIVED"] as const;
export type ItemStatus = (typeof ITEM_STATUSES)[number];

export const ITEM_COSTING_METHODS = ["FIFO", "WEIGHTED_AVG", "STANDARD"] as const;
export type ItemCostingMethod = (typeof ITEM_COSTING_METHODS)[number];

export const ITEM_TRACKING_MODES = ["NONE", "LOT", "SERIAL"] as const;
export type ItemTrackingMode = (typeof ITEM_TRACKING_MODES)[number];

export const ITEM_SOURCES = ["MANUAL", "QUICK_CREATE", "AI", "IMPORT"] as const;
export type ItemSource = (typeof ITEM_SOURCES)[number];

const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  PHYSICAL: "Goods",
  SERVICE: "Service",
  DIGITAL: "Digital",
};

export type ItemTypeChoice = {
  value: ItemType;
  label: string;
  description: string;
};

/** Labels and guidance for the product editor item type picker. */
export const ITEM_TYPE_CHOICES: ItemTypeChoice[] = [
  {
    value: "PHYSICAL",
    label: "Goods",
    description:
      "Tangible products you buy, sell, and can track in stock. Supports variants, dimensions, and inventory.",
  },
  {
    value: "SERVICE",
    label: "Service",
    description:
      "Labor or overhead with no physical stock. Supply-chain role is fixed to Service; variants are not used.",
  },
  {
    value: "DIGITAL",
    label: "Digital",
    description:
      "Non-physical deliverables such as licenses or downloads. No stock tracking; a limited set of supply-chain roles applies.",
  },
];

const ITEM_TYPE_DESCRIPTIONS: Record<ItemType, string> = Object.fromEntries(
  ITEM_TYPE_CHOICES.map((choice) => [choice.value, choice.description])
) as Record<ItemType, string>;

const ITEM_STATUS_LABELS: Record<ItemStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  DISCONTINUED: "Discontinued",
  ARCHIVED: "Archived",
};

const ITEM_COSTING_METHOD_LABELS: Record<ItemCostingMethod, string> = {
  FIFO: "FIFO",
  WEIGHTED_AVG: "Weighted Average",
  STANDARD: "Standard Cost",
};

const ITEM_TRACKING_MODE_LABELS: Record<ItemTrackingMode, string> = {
  NONE: "None",
  LOT: "Lot / Batch",
  SERIAL: "Serial",
};

export function itemTypeLabel(value: ItemType): string {
  return ITEM_TYPE_LABELS[value] ?? value;
}

export function itemTypeDescription(value: ItemType): string {
  return ITEM_TYPE_DESCRIPTIONS[value] ?? "";
}

export function itemTypeChoice(value: ItemType): ItemTypeChoice | undefined {
  return ITEM_TYPE_CHOICES.find((choice) => choice.value === value);
}

export function itemStatusLabel(value: ItemStatus): string {
  return ITEM_STATUS_LABELS[value] ?? value;
}

/** User-facing active/inactive; maps to `items.is_active` in the editor. */
export function itemOperationalStatusLabel(isActive: boolean): string {
  return isActive ? "Active" : "Inactive";
}

/** Persisted `items.status` derived from the operational active flag. */
export function itemLifecycleStatusFromActive(isActive: boolean): ItemStatus {
  return isActive ? "ACTIVE" : "ARCHIVED";
}

export function itemCostingMethodLabel(value: ItemCostingMethod): string {
  return ITEM_COSTING_METHOD_LABELS[value] ?? value;
}

export function itemTrackingModeLabel(value: ItemTrackingMode): string {
  return ITEM_TRACKING_MODE_LABELS[value] ?? value;
}

export function isItemType(value: string): value is ItemType {
  return (ITEM_TYPES as readonly string[]).includes(value);
}

export function isItemStatus(value: string): value is ItemStatus {
  return (ITEM_STATUSES as readonly string[]).includes(value);
}

export function isItemCostingMethod(value: string): value is ItemCostingMethod {
  return (ITEM_COSTING_METHODS as readonly string[]).includes(value);
}

export function isItemTrackingMode(value: string): value is ItemTrackingMode {
  return (ITEM_TRACKING_MODES as readonly string[]).includes(value);
}

export function isItemSource(value: string): value is ItemSource {
  return (ITEM_SOURCES as readonly string[]).includes(value);
}
