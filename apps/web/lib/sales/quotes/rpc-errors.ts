import type { UserFacingError } from "@/lib/errors/user-facing-error";
import { formatStockLocationLabel } from "@/lib/inventory/stock/valuation-engine";
import { SETTINGS_LOCATIONS_HREF } from "@/lib/sales/navigation";

export type SalesQuoteErrorContext = {
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

function replaceLocationTokens(message: string, context: SalesQuoteErrorContext): string {
  const locationLabel = context.locationName
    ? formatStockLocationLabel(context.locationName, context.locationCode)
    : null;

  if (locationLabel && context.locationId) {
    return message.replaceAll(context.locationId, locationLabel);
  }

  return message.replace(UUID_PATTERN, "the selected location");
}

export function formatSalesQuoteRpcError(
  message: string,
  context: SalesQuoteErrorContext = {}
): UserFacingError {
  const locationLabel = context.locationName
    ? formatStockLocationLabel(context.locationName, context.locationCode)
    : "this location";

  if (isDocumentNumberingError(message)) {
    return {
      message: `Quote numbering is not set up for ${locationLabel}. Edit the location and add a Sales quotation document prefix.`,
      action: {
        href: SETTINGS_LOCATIONS_HREF,
        label: "Open Locations settings",
      },
    };
  }

  if (message.toLowerCase().includes("valid_until must be in the future")) {
    return { message: "Valid until must be a future date." };
  }

  if (message.toLowerCase().includes("this sales quotation cannot be edited")) {
    return { message: "This quote can no longer be edited." };
  }

  if (message.toLowerCase().includes("sales quotation edit permission required")) {
    return { message: "You do not have permission to edit sales quotations." };
  }

  if (message.toLowerCase().includes("only approved sales quotations can be converted")) {
    return { message: "Only approved quotes can be converted." };
  }

  if (message.toLowerCase().includes("rejection reason is required")) {
    return { message: "Enter a rejection reason before rejecting this quote." };
  }

  return {
    message: replaceLocationTokens(message, context),
  };
}
