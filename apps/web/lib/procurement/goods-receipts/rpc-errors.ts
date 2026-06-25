import type { UserFacingError } from "@/lib/errors/user-facing-error";
import {
  buildFifoUnsupportedStockError,
  formatStockLocationLabel,
  isFifoValuationError,
} from "@/lib/inventory/stock/valuation-engine";
import { PROCUREMENT_PO_HREF, SETTINGS_LOCATIONS_HREF } from "@/lib/procurement/navigation";

export type GoodsReceiptErrorContext = {
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

function isPoQtyError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("quantity_received exceeds open purchase order") ||
    normalized.includes("purchase order is not open for receiving")
  );
}

function replaceLocationTokens(message: string, context: GoodsReceiptErrorContext): string {
  const locationLabel = context.locationName
    ? formatStockLocationLabel(context.locationName, context.locationCode)
    : null;

  if (locationLabel && context.locationId) {
    return message.replaceAll(context.locationId, locationLabel);
  }

  return message.replace(UUID_PATTERN, "the selected location");
}

export function formatGoodsReceiptRpcError(
  message: string,
  context: GoodsReceiptErrorContext = {}
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
      message: `Goods receipt numbering is not set up for ${locationLabel}. Edit the location and add a GRN document prefix.`,
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

  if (message.toLowerCase().includes("purchase_order_id is required")) {
    return {
      message: "A purchase order is required for goods receipts in this workspace.",
      action: {
        href: PROCUREMENT_PO_HREF,
        label: "Open Purchase Orders",
      },
    };
  }

  if (isPoQtyError(message)) {
    return {
      message: "Receive quantity exceeds the open amount on the purchase order line.",
      action: {
        href: PROCUREMENT_PO_HREF,
        label: "Review purchase order",
      },
    };
  }

  if (isTrackingModeError(message)) {
    return {
      message:
        "Lot and serial tracking are not supported in goods receipts yet. Use quantity-tracked items only.",
    };
  }

  if (message.toLowerCase().includes("item does not track inventory")) {
    return {
      message: "This item does not track inventory. Turn on Track inventory before receiving stock.",
    };
  }

  if (message.toLowerCase().includes("raw_unit_cost is required")) {
    return {
      message: "Enter a unit cost greater than zero for each receipt line.",
    };
  }

  if (message.toLowerCase().includes("insufficient subcontract wip")) {
    return {
      message: message.replace(
        /^insufficient subcontract wip for /i,
        "Insufficient subcontract WIP for "
      ),
      action: {
        href: "/inventory/stock",
        label: "Review stock at WIP",
      },
    };
  }

  return {
    message: replaceLocationTokens(message, context),
  };
}
