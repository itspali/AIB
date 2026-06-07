import type { UserFacingError } from "@/lib/errors/user-facing-error";
import { SETTINGS_LOCATIONS_HREF } from "@/lib/inventory/stock/navigation";

export function formatStockLocationLabel(
  name: string | null | undefined,
  code?: string | null
): string {
  const trimmedName = name?.trim();
  if (!trimmedName) return "this location";
  const trimmedCode = code?.trim();
  return trimmedCode ? `${trimmedName} (${trimmedCode})` : trimmedName;
}

export const SETTINGS_ORGANIZATION_HREF = "/settings/organization";

export type InventoryValuationEngine = "FIFO" | "MWAC" | "STANDARD";

export type FifoBlockReason = "item" | "location" | "tenant-default";

export function normalizeTenantValuationMethod(
  rule: string | null | undefined
): "FIFO" | "MWAC" {
  return rule?.trim().toUpperCase() === "MWAC" ? "MWAC" : "FIFO";
}

/** Mirrors private.resolve_effective_inventory_engine (stock postings only). */
export function resolveStockPostingValuationEngine(input: {
  itemCostingMethod?: string | null;
  locationValuationRule?: string | null;
  tenantValuationMethod?: string | null;
}): InventoryValuationEngine {
  const itemMethod = input.itemCostingMethod?.trim().toUpperCase() ?? "";

  if (itemMethod === "STANDARD") return "STANDARD";
  if (itemMethod === "FIFO") return "FIFO";

  if (input.locationValuationRule) {
    return input.locationValuationRule.trim().toUpperCase() === "MWAC" ? "MWAC" : "FIFO";
  }

  return normalizeTenantValuationMethod(input.tenantValuationMethod);
}

export function resolveFifoBlockReason(input: {
  itemCostingMethod?: string | null;
  locationValuationRule?: string | null;
}): FifoBlockReason {
  if (input.itemCostingMethod?.trim().toUpperCase() === "FIFO") {
    return "item";
  }
  if (input.locationValuationRule?.trim().toUpperCase() === "FIFO") {
    return "location";
  }
  return "tenant-default";
}

export function buildFifoUnsupportedStockError(
  locationName?: string | null,
  locationCode?: string | null,
  reason: FifoBlockReason = "tenant-default"
): UserFacingError {
  const locationLabel = formatStockLocationLabel(locationName, locationCode);

  if (reason === "item") {
    return {
      message:
        "This item uses FIFO costing, which stock postings do not support yet. Switch the item to Average (MWAC) or Standard cost before posting opening stock.",
    };
  }

  if (reason === "location") {
    return {
      message: `${locationLabel} is set to FIFO valuation. Stock postings require MWAC (moving average) until FIFO layers are supported. Edit the location and set Valuation calculation to MWAC.`,
      action: {
        href: SETTINGS_LOCATIONS_HREF,
        label: "Open Locations settings",
      },
    };
  }

  return {
    message: `${locationLabel} inherits FIFO valuation from your organization default. Stock postings require MWAC until FIFO layers are supported. Set Valuation calculation to MWAC on the location, or change the organization default.`,
    action: {
      href: SETTINGS_ORGANIZATION_HREF,
      label: "Open Organization settings",
    },
  };
}

export function isFifoValuationError(message: string): boolean {
  return message.toLowerCase().includes("fifo valuation calculation layers");
}
