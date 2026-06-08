import type { UserFacingError } from "@/lib/errors/user-facing-error";
import { formatStockLocationLabel, isFifoValuationError } from "@/lib/inventory/stock/valuation-engine";
import { SETTINGS_LOCATIONS_HREF } from "@/lib/procurement/navigation";

export type PurchaseOrderErrorContext = {
  locationId?: string;
  locationName?: string;
  locationCode?: string;
};

const UUID_PATTERN =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function isDocumentNumberingError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("document naming not configured") ||
    normalized.includes("document sequence not configured") ||
    normalized.includes("document prefix not configured")
  );
}

function isTrackingModeError(message: string): boolean {
  return message.toLowerCase().includes("lot and serial tracking are not supported");
}

function replaceLocationTokens(message: string, context: PurchaseOrderErrorContext): string {
  const locationLabel = context.locationName
    ? formatStockLocationLabel(context.locationName, context.locationCode)
    : null;

  if (locationLabel && context.locationId) {
    return message.replaceAll(context.locationId, locationLabel);
  }

  return message.replace(UUID_PATTERN, "the selected location");
}

export function formatPurchaseOrderRpcError(
  message: string,
  context: PurchaseOrderErrorContext = {}
): UserFacingError {
  const locationLabel = context.locationName
    ? formatStockLocationLabel(context.locationName, context.locationCode)
    : "this location";

  if (isDocumentNumberingError(message)) {
    return {
      message: `Purchase order numbering is not set up for ${locationLabel}. Edit the location and add a Purchase order document prefix.`,
      action: {
        href: SETTINGS_LOCATIONS_HREF,
        label: "Open Locations settings",
      },
    };
  }

  if (message.toLowerCase().includes("destination location cannot hold inventory")) {
    return {
      message: `${locationLabel} cannot hold inventory. Choose a stock-holding storage location.`,
      action: {
        href: SETTINGS_LOCATIONS_HREF,
        label: "Review locations",
      },
    };
  }

  if (message.toLowerCase().includes("entity is not a supplier")) {
    return {
      message: "The selected party is not registered as a supplier.",
    };
  }

  if (isTrackingModeError(message)) {
    return {
      message:
        "Lot and serial tracking are not supported in purchase orders yet. Use quantity-tracked items only.",
    };
  }

  if (message.toLowerCase().includes("item does not track inventory")) {
    return {
      message: "This item does not track inventory. Turn on Track inventory before adding it to a PO.",
    };
  }

  if (message.toLowerCase().includes("only draft purchase orders can be edited")) {
    return {
      message: "Only draft purchase orders can be edited.",
    };
  }

  if (message.toLowerCase().includes("only draft purchase orders can be issued")) {
    return {
      message: "Only draft purchase orders can be issued.",
    };
  }

  return {
    message: replaceLocationTokens(message, context),
  };
}
