import type { LocationRow, LocationTopologyRow, PresenceEnvironment } from "@/lib/locations/types";

type AxisLocation = Pick<
  LocationRow | LocationTopologyRow,
  | "presence_type"
  | "is_administrative_office"
  | "is_commercial_storefront"
  | "is_manufacturing_floor"
  | "is_stock_holding"
  | "pos_terminal_count"
>;

export function presenceLabel(
  presence: LocationRow["presence_type"]
): string {
  return presence === "VIRTUAL" ? "Virtual" : "Physical";
}

export function locationCapabilitySummary(location: AxisLocation): string {
  const parts: string[] = [presenceLabel(location.presence_type)];
  if (location.is_administrative_office) {
    parts.push(adminCapabilitySummaryLabel(location.presence_type));
  }
  if (location.is_commercial_storefront) {
    parts.push(storefrontCapabilitySummaryLabel(location.presence_type));
  }
  if (location.is_stock_holding) parts.push("Warehouse");
  if (location.is_manufacturing_floor) parts.push("Plant");
  return parts.join(" · ");
}

export function adminCapabilityCardTitle(presence: PresenceEnvironment): string {
  return presence === "VIRTUAL"
    ? "Administrative / Digital HQ"
    : "Administrative / HQ Office";
}

export function adminCapabilityToggleLabel(presence: PresenceEnvironment): string {
  return presence === "VIRTUAL"
    ? "Mark as digital headquarters or administrative office"
    : "Mark as business headquarters or administrative office";
}

export function storefrontCapabilityCardTitle(presence: PresenceEnvironment): string {
  return presence === "VIRTUAL" ? "Digital Sales Channels" : "POS Terminal Registry";
}

export function storefrontCapabilityToggleLabel(presence: PresenceEnvironment): string {
  return presence === "VIRTUAL"
    ? "Operates digital storefronts or online sales desks"
    : "Operates a consumer retail storefront / sales desk";
}

export function posCountFieldLabel(presence: PresenceEnvironment): string {
  return presence === "VIRTUAL"
    ? "Number of active digital checkout / billing endpoints"
    : "Number of active cash registers / billing terminals";
}

export function adminCapabilitySummaryLabel(presence: PresenceEnvironment): string {
  return presence === "VIRTUAL" ? "Digital HQ/Admin" : "HQ/Admin";
}

export function storefrontCapabilitySummaryLabel(presence: PresenceEnvironment): string {
  return presence === "VIRTUAL" ? "Digital sales" : "Storefront";
}

export function storefrontMicroBadgeLabel(presence: PresenceEnvironment): string {
  return presence === "VIRTUAL" ? "DIGITAL" : "STORE";
}

export function detailAdminCapabilityText(presence: PresenceEnvironment): string {
  return presence === "VIRTUAL"
    ? "Digital headquarters or administrative office"
    : "Business / HQ administrative office";
}

export function detailStorefrontCapabilityText(
  location: Pick<AxisLocation, "presence_type" | "pos_terminal_count">
): string {
  if (location.presence_type === "VIRTUAL") {
    return location.pos_terminal_count > 0
      ? `Digital sales channels · ${location.pos_terminal_count} active billing endpoints`
      : "Digital sales channels";
  }
  return location.pos_terminal_count > 0
    ? `Commercial storefront · ${location.pos_terminal_count} active POS terminals`
    : "Commercial storefront";
}

export function posCountCompactLabel(presence: PresenceEnvironment, count: number): string {
  if (count <= 0) return "";
  return presence === "VIRTUAL" ? ` · ${count} endpoints` : ` · ${count} POS`;
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
      label: adminCapabilitySummaryLabel(location.presence_type),
      className:
        "bg-emerald-500/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:text-emerald-300",
    });
  }
  if (location.is_commercial_storefront) {
    badges.push({
      key: "store",
      label: storefrontMicroBadgeLabel(location.presence_type),
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
