import type { LocationRow } from "@/lib/locations/types";
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

export function hierarchyEnabled(
  governance: OrganizationLocationGovernanceConfig
): boolean {
  return governance.multi_location_enabled && governance.regional_hqs_enabled;
}

export function eligibleParentLocations(
  rows: LocationRow[],
  currentLocationId: string | null
): LocationRow[] {
  return filterOperationalLocations(rows).filter(
    (row) => row.is_active && row.id !== currentLocationId
  );
}
