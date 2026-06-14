import type { UserFacingError } from "@/lib/errors/user-facing-error";
import { formatStockLocationLabel } from "@/lib/inventory/stock/valuation-engine";
import { SETTINGS_LOCATIONS_HREF } from "@/lib/sales/navigation";

export type SalesInvoiceErrorContext = {
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

function replaceLocationTokens(message: string, context: SalesInvoiceErrorContext): string {
  const locationLabel = context.locationName
    ? formatStockLocationLabel(context.locationName, context.locationCode)
    : null;

  if (locationLabel && context.locationId) {
    return message.replaceAll(context.locationId, locationLabel);
  }

  return message.replace(UUID_PATTERN, "the selected location");
}

export function formatSalesInvoiceRpcError(
  message: string,
  context: SalesInvoiceErrorContext = {}
): UserFacingError {
  const locationLabel = context.locationName
    ? formatStockLocationLabel(context.locationName, context.locationCode)
    : "this location";

  if (isDocumentNumberingError(message)) {
    return {
      message: `Invoice numbering is not set up for ${locationLabel}. Edit the location and add a Sales invoice document prefix.`,
      action: {
        href: SETTINGS_LOCATIONS_HREF,
        label: "Open Locations settings",
      },
    };
  }

  if (message.toLowerCase().includes("only draft sales invoices can be saved")) {
    return { message: "Only draft invoices can be edited." };
  }

  if (message.toLowerCase().includes("only draft sales invoices can be posted")) {
    return { message: "Only draft invoices can be posted." };
  }

  if (message.toLowerCase().includes("sales invoice edit permission required")) {
    return { message: "You do not have permission to edit sales invoices." };
  }

  if (message.toLowerCase().includes("rejection reason is required")) {
    return { message: "Enter a rejection reason before rejecting this invoice." };
  }

  return {
    message: replaceLocationTokens(message, context),
  };
}
