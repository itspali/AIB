import { SETTINGS_ROUTES } from "@/lib/settings/navigation";

export const TRANSFERS_HREF = "/inventory/transfers";

export const SETTINGS_LOCATIONS_HREF = SETTINGS_ROUTES.workspaceLocations;

/** Pre-fills the create drawer when transferring to restock a low site. */
export const TRANSFER_DRAWER_SOURCE_PARAM = "src";

export const TRANSFER_DRAWER_DEST_PARAM = "dest";

/** List toolbar status filter (e.g. from inventory overview in-transit card). */
export const TRANSFER_STATUS_FILTER_PARAM = "status";

export function transfersHrefWithStatusFilter(status: string): string {
  return `${TRANSFERS_HREF}?${TRANSFER_STATUS_FILTER_PARAM}=${encodeURIComponent(status)}`;
}
