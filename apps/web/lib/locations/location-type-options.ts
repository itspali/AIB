import type { LocationOperationalType } from "@/lib/locations/types";
import { ENTERPRISE_LOCATION_TYPES } from "@/lib/locations/types";
import { locationTypeLabel } from "@/lib/locations/topology";

export function enterpriseLocationTypeOptions(): Array<{
  value: LocationOperationalType;
  label: string;
}> {
  return ENTERPRISE_LOCATION_TYPES.map((value) => ({
    value,
    label: locationTypeLabel(value),
  }));
}

export function flatLocationTypeOptions(): Array<{
  value: LocationOperationalType;
  label: string;
}> {
  return [
    "STORAGE_WAREHOUSE",
    "OFFICE_BRANCH",
    "COUNTRY_HQ",
    "GLOBAL_HQ",
  ].map((value) => ({
    value: value as LocationOperationalType,
    label: locationTypeLabel(value as LocationOperationalType),
  }));
}
