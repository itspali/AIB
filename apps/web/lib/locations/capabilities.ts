import type { LocationOperationalType, LocationRow } from "@/lib/locations/types";

const NON_STOCK_TYPES: LocationOperationalType[] = [
  "GLOBAL_HQ",
  "SUBCONTINENTAL_HQ",
  "COUNTRY_HQ",
  "REGIONAL_ZONE",
  "STATE_HQ",
  "OFFICE_BRANCH",
  "VIRTUAL_STOREFRONT",
  "HEAD_OFFICE",
  "REGIONAL_HQ",
  "RETAIL_OUTLET",
];

export function locationSupportsInventoryOps(
  location: Pick<LocationRow, "is_stock_holding" | "location_type">
): boolean {
  if (!location.is_stock_holding) return false;
  return !NON_STOCK_TYPES.includes(location.location_type);
}

export function defaultStockHoldingForType(locationType: LocationOperationalType): boolean {
  return (
    locationType === "STORAGE_WAREHOUSE" ||
    locationType === "WAREHOUSE" ||
    locationType === "MANUFACTURING_PLANT"
  );
}
