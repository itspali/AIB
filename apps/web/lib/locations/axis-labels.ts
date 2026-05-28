import type { LocationRow, LocationTopologyRow, PresenceEnvironment } from "@/lib/locations/types";
import type { LocationTagVariant } from "@/lib/locations/types";

export function presenceLabel(presence: PresenceEnvironment): string {
  return presence === "VIRTUAL" ? "Virtual" : "Physical";
}

export function locationCapabilitySummary(
  location: Pick<
    LocationRow | LocationTopologyRow,
    | "presence_type"
    | "is_administrative_office"
    | "is_commercial_storefront"
    | "is_stock_holding"
  >
): string {
  const parts: string[] = [presenceLabel(location.presence_type)];
  if (location.is_administrative_office) parts.push("Business");
  if (location.is_commercial_storefront) parts.push("Storefront");
  if (location.is_stock_holding) parts.push("Storage");
  return parts.join(" · ");
}

export function resolveLocationTagVariant(
  location: Pick<
    LocationRow | LocationTopologyRow,
    "presence_type" | "is_administrative_office" | "is_commercial_storefront" | "is_stock_holding"
  >
): LocationTagVariant {
  if (location.presence_type === "VIRTUAL" && location.is_commercial_storefront) {
    return "active";
  }
  if (location.is_stock_holding) {
    return "completed";
  }
  return "administrative";
}

export function tagLabel(variant: LocationTagVariant): string {
  switch (variant) {
    case "completed":
      return "FULFILLMENT";
    case "active":
      return "VIRTUAL";
    default:
      return "ADMIN";
  }
}
