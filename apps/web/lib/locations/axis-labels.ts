import type { LocationRow, LocationTopologyRow } from "@/lib/locations/types";

type AxisLocation = Pick<
  LocationRow | LocationTopologyRow,
  | "presence_type"
  | "is_administrative_office"
  | "is_commercial_storefront"
  | "is_manufacturing_floor"
  | "is_stock_holding"
>;

export function presenceLabel(
  presence: LocationRow["presence_type"]
): string {
  return presence === "VIRTUAL" ? "Virtual" : "Physical";
}

export function locationCapabilitySummary(location: AxisLocation): string {
  const parts: string[] = [presenceLabel(location.presence_type)];
  if (location.is_administrative_office) parts.push("HQ/Admin");
  if (location.is_commercial_storefront) parts.push("Storefront");
  if (location.is_stock_holding) parts.push("Warehouse");
  if (location.is_manufacturing_floor) parts.push("Plant");
  return parts.join(" · ");
}

export type LocationTagVariant = "administrative" | "completed" | "active";

export function resolveLocationTagVariant(location: AxisLocation): LocationTagVariant {
  if (location.presence_type === "VIRTUAL" && location.is_commercial_storefront) {
    return "active";
  }
  if (location.is_stock_holding || location.is_manufacturing_floor) {
    return "completed";
  }
  return "administrative";
}

export function tagLabel(variant: LocationTagVariant): string {
  switch (variant) {
    case "completed":
      return "OPERATIONS";
    case "active":
      return "VIRTUAL";
    default:
      return "ADMIN";
  }
}

export type AxisMicroBadge = {
  key: string;
  label: string;
  className: string;
};

export function resolveAxisMicroBadges(location: AxisLocation): AxisMicroBadge[] {
  const badges: AxisMicroBadge[] = [];

  if (location.is_administrative_office) {
    badges.push({
      key: "admin",
      label: "HQ/Admin",
      className:
        "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300",
    });
  }
  if (location.is_commercial_storefront) {
    badges.push({
      key: "store",
      label: "STORE",
      className:
        "bg-indigo-500/15 text-indigo-700 ring-1 ring-indigo-500/30 dark:text-indigo-300",
    });
  }
  if (location.is_stock_holding) {
    badges.push({
      key: "warehouse",
      label: "WH",
      className:
        "bg-amber-500/15 text-amber-800 ring-1 ring-amber-500/30 dark:text-amber-300",
    });
  }
  if (location.is_manufacturing_floor) {
    badges.push({
      key: "plant",
      label: "PLANT",
      className:
        "bg-red-500/15 text-red-800 ring-1 ring-red-500/30 dark:text-red-300",
    });
  }

  return badges;
}
