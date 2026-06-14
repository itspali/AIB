import type { UserFacingError } from "@/lib/errors/user-facing-error";
import { formatStockLocationLabel } from "@/lib/inventory/stock/valuation-engine";
import { SETTINGS_LOCATIONS_HREF } from "@/lib/sales/navigation";

export type SalesOrderErrorContext = {
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

function replaceLocationTokens(message: string, context: SalesOrderErrorContext): string {
  const locationLabel = context.locationName
    ? formatStockLocationLabel(context.locationName, context.locationCode)
    : null;

  if (locationLabel && context.locationId) {
    return message.replaceAll(context.locationId, locationLabel);
  }

  return message.replace(UUID_PATTERN, "the selected location");
}

export function formatSalesOrderRpcError(
  message: string,
  context: SalesOrderErrorContext = {}
): UserFacingError {
  const locationLabel = context.locationName
    ? formatStockLocationLabel(context.locationName, context.locationCode)
    : "this location";

  if (isDocumentNumberingError(message)) {
    return {
      message: `Sales order numbering is not set up for ${locationLabel}. Edit the location and add a Sales order document prefix.`,
      action: {
        href: SETTINGS_LOCATIONS_HREF,
        label: "Open Locations settings",
      },
    };
  }

  if (message.toLowerCase().includes("shipping location cannot hold inventory")) {
    return {
      message: `${locationLabel} cannot hold inventory. Choose a stock-holding storage location.`,
      action: {
        href: SETTINGS_LOCATIONS_HREF,
        label: "Review locations",
      },
    };
  }

  if (message.toLowerCase().includes("entity is not a customer")) {
    return {
      message: "The selected party is not registered as a customer.",
    };
  }

  if (message.toLowerCase().includes("only draft sales orders can be edited")) {
    return {
      message: "Only draft sales orders can be edited.",
    };
  }

  if (message.toLowerCase().includes("only draft sales orders can be confirmed")) {
    return {
      message: "Only draft sales orders can be confirmed.",
    };
  }

  if (message.toLowerCase().includes("sales order approval is required before confirm")) {
    return {
      message: "This sales order must be submitted and approved before it can be confirmed.",
    };
  }

  if (message.toLowerCase().includes("only draft sales orders can be submitted for approval")) {
    return {
      message: "Only draft sales orders can be submitted for approval.",
    };
  }

  if (message.toLowerCase().includes("approval is not required for this sales order")) {
    return {
      message: "Approval is not required for this sales order. Use Confirm instead.",
    };
  }

  if (
    message.toLowerCase().includes("sales order approver permission required for this amount")
  ) {
    return {
      message:
        "This sales order exceeds the approval threshold. Only a workspace owner can approve or reject it.",
    };
  }

  if (message.toLowerCase().includes("sales order approver permission required")) {
    return {
      message: "You do not have permission to approve or reject sales orders.",
    };
  }

  if (message.toLowerCase().includes("submitter cannot self-approve this sales order")) {
    return {
      message:
        "You cannot approve your own submission when the sales order exceeds the approval threshold. Another approver or a workspace owner must approve it.",
    };
  }

  if (message.toLowerCase().includes("rejection reason is required")) {
    return {
      message: "Enter a rejection reason before rejecting this sales order.",
    };
  }

  if (message.toLowerCase().includes("credit limit exceeded")) {
    return {
      message: "This order exceeds the customer's credit limit and cannot be confirmed.",
    };
  }

  if (
    message.toLowerCase().includes("sales_orders_tenant_voucher_unique") ||
    message.toLowerCase().includes("duplicate key value") ||
    message.toLowerCase().includes("already exists")
  ) {
    return {
      message: "That SO number is already used. Choose a different number.",
    };
  }

  if (message.toLowerCase().includes("only draft sales orders can change so number")) {
    return {
      message: "Only draft sales orders can change SO number.",
    };
  }

  return {
    message: replaceLocationTokens(message, context),
  };
}
