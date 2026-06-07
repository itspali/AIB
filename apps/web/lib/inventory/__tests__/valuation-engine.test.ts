import { describe, expect, it } from "vitest";
import {
  buildFifoUnsupportedStockError,
  resolveFifoBlockReason,
  resolveStockPostingValuationEngine,
} from "@/lib/inventory/stock/valuation-engine";
import { SETTINGS_LOCATIONS_HREF } from "@/lib/inventory/stock/navigation";
import { SETTINGS_ORGANIZATION_HREF } from "@/lib/inventory/stock/valuation-engine";

describe("valuation-engine", () => {
  it("defaults tenant valuation to FIFO when unset", () => {
    expect(
      resolveStockPostingValuationEngine({
        itemCostingMethod: null,
        locationValuationRule: null,
        tenantValuationMethod: null,
      })
    ).toBe("FIFO");
  });

  it("uses location MWAC override over tenant FIFO default", () => {
    expect(
      resolveStockPostingValuationEngine({
        itemCostingMethod: null,
        locationValuationRule: "MWAC",
        tenantValuationMethod: "FIFO",
      })
    ).toBe("MWAC");
  });

  it("buildFifoUnsupportedStockError links to locations for location FIFO", () => {
    const error = buildFifoUnsupportedStockError("NSP Branch", "NSP", "location");
    expect(error.message).toContain("NSP Branch (NSP)");
    expect(error.action?.href).toBe(SETTINGS_LOCATIONS_HREF);
  });

  it("buildFifoUnsupportedStockError links to organization for inherited FIFO", () => {
    const error = buildFifoUnsupportedStockError("Head Office", "HO", "tenant-default");
    expect(error.action?.href).toBe(SETTINGS_ORGANIZATION_HREF);
  });

  it("resolveFifoBlockReason identifies location-specific FIFO", () => {
    expect(
      resolveFifoBlockReason({
        itemCostingMethod: null,
        locationValuationRule: "FIFO",
      })
    ).toBe("location");
  });
});
