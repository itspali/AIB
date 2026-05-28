import type { LocationOperationalType, LocationRow } from "@/lib/locations/types";
import type { OrganizationLocationGovernanceConfig } from "@/lib/organization/types";

export function isSystemLocationCode(code: string): boolean {
  return code.startsWith("_SYSTEM_");
}

export function filterOperationalLocations(rows: LocationRow[]): LocationRow[] {
  return rows.filter((row) => !isSystemLocationCode(row.code));
}

export function canAddLocation(
  governance: OrganizationLocationGovernanceConfig,
  operationalCount: number
): boolean {
  if (!governance.multi_location_enabled) return operationalCount === 0;
  return true;
}

export function allowedParentTypes(
  childType: LocationOperationalType
): LocationOperationalType[] {
  switch (childType) {
    case "GLOBAL_HQ":
      return [];
    case "SUBCONTINENTAL_HQ":
      return ["GLOBAL_HQ"];
    case "COUNTRY_HQ":
      return ["GLOBAL_HQ", "SUBCONTINENTAL_HQ"];
    case "REGIONAL_ZONE":
      return ["COUNTRY_HQ"];
    case "STATE_HQ":
    case "STORAGE_WAREHOUSE":
    case "OFFICE_BRANCH":
      return ["REGIONAL_ZONE", "STATE_HQ"];
    case "VIRTUAL_STOREFRONT":
      return ["COUNTRY_HQ", "REGIONAL_ZONE"];
    default:
      return [];
  }
}

export function hierarchyEnabled(
  governance: OrganizationLocationGovernanceConfig
): boolean {
  return governance.multi_location_enabled && governance.regional_hqs_enabled;
}

export function eligibleParentLocations(
  rows: LocationRow[],
  childType: LocationOperationalType,
  currentLocationId: string | null
): LocationRow[] {
  const allowedTypes = allowedParentTypes(childType);
  return filterOperationalLocations(rows).filter(
    (row) =>
      row.is_active &&
      allowedTypes.includes(row.location_type) &&
      row.id !== currentLocationId
  );
}
