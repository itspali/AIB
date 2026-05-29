import type { FilterScope, FilterValueOption } from "@/lib/search/types";

const CLASSIFICATION_OPTIONS: FilterValueOption[] = [
  { value: "PHYSICAL_GOOD", label: "Physical good" },
  { value: "RAW_MATERIAL", label: "Raw material" },
  { value: "WORK_IN_PROGRESS", label: "Work in progress" },
  { value: "FINISHED_GOOD", label: "Finished good" },
  { value: "SERVICE_OVERHEAD", label: "Service overhead" },
  { value: "KIT_BUNDLE", label: "Kit bundle" },
];

const UOM_OPTIONS: FilterValueOption[] = [
  { value: "pieces", label: "Pieces" },
  { value: "kg", label: "Kilograms" },
  { value: "liters", label: "Liters" },
  { value: "meters", label: "Meters" },
  { value: "boxes", label: "Boxes" },
];

const BOOLEAN_OPTIONS: FilterValueOption[] = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

const LOCATION_TYPE_OPTIONS: FilterValueOption[] = [
  { value: "HEAD_OFFICE", label: "Head office" },
  { value: "WAREHOUSE", label: "Warehouse" },
  { value: "RETAIL_OUTLET", label: "Retail outlet" },
  { value: "MANUFACTURING_PLANT", label: "Manufacturing plant" },
  { value: "GLOBAL_HQ", label: "Global HQ" },
];

/**
 * Returns deterministic value options for fields whose catalog never changes,
 * so the omnibar can populate hints without a server round-trip. Returns null
 * for fields whose values must be resolved server-side (e.g. category names, cities).
 */
export function getStaticValueOptions(
  scope: FilterScope,
  fieldKey: string
): FilterValueOption[] | null {
  if (fieldKey === "is_active") return BOOLEAN_OPTIONS;
  if (fieldKey === "classification") return CLASSIFICATION_OPTIONS;
  if (fieldKey === "base_unit_of_measure") return UOM_OPTIONS;
  if (fieldKey === "location_type" && scope === "locations") return LOCATION_TYPE_OPTIONS;
  return null;
}

const dynamicCache = new Map<string, FilterValueOption[]>();

function cacheKey(scope: FilterScope, fieldKey: string): string {
  return `${scope}:${fieldKey}`;
}

export function getCachedValueOptions(
  scope: FilterScope,
  fieldKey: string
): FilterValueOption[] | null {
  return dynamicCache.get(cacheKey(scope, fieldKey)) ?? null;
}

export function setCachedValueOptions(
  scope: FilterScope,
  fieldKey: string,
  options: FilterValueOption[]
): void {
  dynamicCache.set(cacheKey(scope, fieldKey), options);
}

export function invalidateValueOptionCache(scope?: FilterScope, fieldKey?: string): void {
  if (scope && fieldKey) {
    dynamicCache.delete(cacheKey(scope, fieldKey));
    return;
  }
  dynamicCache.clear();
}
