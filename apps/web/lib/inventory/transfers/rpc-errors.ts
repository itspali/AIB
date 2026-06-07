import type { UserFacingError } from "@/lib/errors/user-facing-error";
import {
  formatStockLocationLabel,
  isFifoValuationError,
  buildFifoUnsupportedStockError,
} from "@/lib/inventory/stock/valuation-engine";
import { SETTINGS_LOCATIONS_HREF } from "@/lib/inventory/transfers/navigation";

export { formatStockLocationLabel };

export type TransferErrorContext = {
  sourceLocationId?: string;
  sourceLocationName?: string;
  sourceLocationCode?: string;
  destinationLocationId?: string;
  destinationLocationName?: string;
  destinationLocationCode?: string;
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

function isInsufficientOnHandError(message: string): boolean {
  return message.toLowerCase().includes("insufficient on-hand");
}

function isTrackingModeError(message: string): boolean {
  return message.toLowerCase().includes("lot and serial tracking are not supported");
}

function isReceiptQuantityError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("receipt quantities cannot exceed") ||
    normalized.includes("all receipt quantities must be entered") ||
    normalized.includes("receipt quantities cannot be negative")
  );
}

function replaceLocationTokens(message: string, context: TransferErrorContext): string {
  let result = message;

  if (context.sourceLocationName && context.sourceLocationId) {
    const label = formatStockLocationLabel(
      context.sourceLocationName,
      context.sourceLocationCode
    );
    result = result.replaceAll(context.sourceLocationId, label);
  }

  if (context.destinationLocationName && context.destinationLocationId) {
    const label = formatStockLocationLabel(
      context.destinationLocationName,
      context.destinationLocationCode
    );
    result = result.replaceAll(context.destinationLocationId, label);
  }

  return result.replace(UUID_PATTERN, "the selected location");
}

/** Turn raw stock transfer RPC errors into operator-facing copy. */
export function formatStockTransferRpcError(
  message: string,
  context: TransferErrorContext = {}
): UserFacingError {
  const sourceLabel = context.sourceLocationName
    ? formatStockLocationLabel(context.sourceLocationName, context.sourceLocationCode)
    : "the source location";

  if (isFifoValuationError(message)) {
    return buildFifoUnsupportedStockError(
      context.sourceLocationName,
      context.sourceLocationCode,
      "location"
    );
  }

  if (isDocumentNumberingError(message)) {
    return {
      message: `Stock transfer numbering is not set up for ${sourceLabel}. Edit the location and add a Stock transfer document prefix.`,
      action: {
        href: SETTINGS_LOCATIONS_HREF,
        label: "Open Locations settings",
      },
    };
  }

  if (isInsufficientOnHandError(message)) {
    return {
      message:
        "Source location does not have enough on-hand quantity for one or more lines. Reduce quantities or post a stock adjustment first.",
    };
  }

  if (isTrackingModeError(message)) {
    return {
      message: "Lot and serial tracked items cannot be transferred in this version yet.",
    };
  }

  if (isReceiptQuantityError(message)) {
    return {
      message:
        "Receipt quantities must account for every dispatched unit on each line (accepted + damaged + lost).",
    };
  }

  return {
    message: replaceLocationTokens(message, context),
  };
}
