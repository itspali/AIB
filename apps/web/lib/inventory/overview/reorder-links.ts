import { STOCK_DRAWER_LOCATION_PARAM, STOCK_HREF } from "@/lib/inventory/stock/navigation";
import {
  TRANSFER_DRAWER_DEST_PARAM,
  TRANSFER_DRAWER_SOURCE_PARAM,
  TRANSFERS_HREF,
} from "@/lib/inventory/transfers/navigation";
import { MODULE_DRAWER_ACTION_NEW, MODULE_DRAWER_VARIANT_PARAM } from "@/lib/layout/module-drawer-url";

export function buildReorderAdjustHref(input: {
  variantId: string;
  locationId: string;
}): string {
  const params = new URLSearchParams({
    action: MODULE_DRAWER_ACTION_NEW,
    [MODULE_DRAWER_VARIANT_PARAM]: input.variantId,
    [STOCK_DRAWER_LOCATION_PARAM]: input.locationId,
  });
  return `${STOCK_HREF}?${params.toString()}`;
}

/** Destination is the low-stock site; source is optional when another location has surplus. */
export function buildReorderTransferHref(input: {
  variantId: string;
  destinationLocationId: string;
  sourceLocationId?: string | null;
}): string {
  const params = new URLSearchParams({
    action: MODULE_DRAWER_ACTION_NEW,
    [MODULE_DRAWER_VARIANT_PARAM]: input.variantId,
    [TRANSFER_DRAWER_DEST_PARAM]: input.destinationLocationId,
  });
  if (input.sourceLocationId?.trim()) {
    params.set(TRANSFER_DRAWER_SOURCE_PARAM, input.sourceLocationId.trim());
  }
  return `${TRANSFERS_HREF}?${params.toString()}`;
}
