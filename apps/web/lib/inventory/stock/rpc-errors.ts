import type { UserFacingError } from "@/lib/errors/user-facing-error";
import {
  buildFifoUnsupportedStockError,
  formatStockLocationLabel,
  isFifoValuationError,
} from "@/lib/inventory/stock/valuation-engine";
import { SETTINGS_LOCATIONS_HREF, STOCK_HREF } from "@/lib/inventory/stock/navigation";

export { formatStockLocationLabel };

export type StockAdjustmentErrorContext = {
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

function isOpeningStockError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("opening balance requires zero on-hand") ||
    normalized.includes("opening adjustments cannot reduce stock")
  );
}

function isTrackingModeError(message: string): boolean {
  return message.toLowerCase().includes("lot and serial tracking are not supported");
}

function isStyleAnchorError(message: string): boolean {
  return message.toLowerCase().includes("non-sellable style anchor");
}

function replaceLocationTokens(message: string, context: StockAdjustmentErrorContext): string {
  const locationLabel = context.locationName
    ? formatStockLocationLabel(context.locationName, context.locationCode)
    : null;

  if (locationLabel && context.locationId) {
    return message.replaceAll(context.locationId, locationLabel);
  }

  return message.replace(UUID_PATTERN, "the selected location");
}

/** Turn raw post_stock_adjustment RPC errors into operator-facing copy. */
export function formatStockAdjustmentRpcError(
  message: string,
  context: StockAdjustmentErrorContext = {}
): UserFacingError {
  const locationLabel = context.locationName
    ? formatStockLocationLabel(context.locationName, context.locationCode)
    : "this location";

  if (isFifoValuationError(message)) {
    return buildFifoUnsupportedStockError(
      context.locationName,
      context.locationCode,
      "location"
    );
  }

  if (isDocumentNumberingError(message)) {
    return {
      message: `Stock adjustment numbering is not set up for ${locationLabel}. Edit the location and add a Stock adjustment document prefix.`,
      action: {
        href: SETTINGS_LOCATIONS_HREF,
        label: "Open Locations settings",
      },
    };
  }

  if (message.toLowerCase().includes("location cannot hold inventory")) {
    return {
      message: `${locationLabel} cannot hold inventory. Choose a stock-holding storage location.`,
      action: {
        href: SETTINGS_LOCATIONS_HREF,
        label: "Review locations",
      },
    };
  }

  if (message.toLowerCase().includes("location not found")) {
    return {
      message: `Location ${locationLabel} was not found or is no longer active.`,
      action: {
        href: SETTINGS_LOCATIONS_HREF,
        label: "Open Locations settings",
      },
    };
  }

  if (isOpeningStockError(message)) {
    return {
      message: `Opening stock for ${locationLabel}: on-hand must be zero before posting an opening balance. Post corrections from Stock after go-live.`,
      action: {
        href: STOCK_HREF,
        label: "Open Stock",
      },
    };
  }

  if (isTrackingModeError(message)) {
    return {
      message:
        "Lot and serial tracking are not supported in stock adjustments yet. Use quantity-tracked items only.",
    };
  }

  if (isStyleAnchorError(message)) {
    return {
      message:
        "Style anchor SKUs cannot receive inventory. Enter opening stock on sellable variant SKUs only.",
    };
  }

  if (message.toLowerCase().includes("item does not track inventory")) {
    return {
      message: "This item does not track inventory. Turn on Track inventory before posting stock.",
    };
  }

  if (message.toLowerCase().includes("unit_cost is required")) {
    return {
      message: "Enter a unit cost greater than zero for each opening quantity.",
    };
  }

  return {
    message: replaceLocationTokens(message, context),
  };
}
