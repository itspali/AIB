import { describe, expect, it } from "vitest";
import {
  formatStockAdjustmentRpcError,
  formatStockLocationLabel,
} from "@/lib/inventory/stock/rpc-errors";
import { SETTINGS_LOCATIONS_HREF, STOCK_HREF } from "@/lib/inventory/stock/navigation";

describe("stock rpc-errors", () => {
  it("formatStockLocationLabel includes code when present", () => {
    expect(formatStockLocationLabel("Head Office", "HO")).toBe("Head Office (HO)");
    expect(formatStockLocationLabel("NSP Branch", "")).toBe("NSP Branch");
  });

  it("formats document naming errors with location name and settings link", () => {
    const message =
      "document naming not configured for location 9952be31-7686-450e-a86c-f7f4253e8b5a, type STOCK_ADJUSTMENT";
    const formatted = formatStockAdjustmentRpcError(message, {
      locationId: "9952be31-7686-450e-a86c-f7f4253e8b5a",
      locationName: "Head Office",
      locationCode: "HO",
    });

    expect(formatted.message).toContain("Head Office (HO)");
    expect(formatted.message).not.toContain("9952be31");
    expect(formatted.action).toEqual({
      href: SETTINGS_LOCATIONS_HREF,
      label: "Open Locations settings",
    });
  });

  it("formats FIFO valuation errors with locations link", () => {
    const formatted = formatStockAdjustmentRpcError(
      "FIFO valuation calculation layers are not yet supported in the backend ledger engine.",
      { locationName: "NSP Branch", locationCode: "NSP" }
    );

    expect(formatted.message).toContain("NSP Branch (NSP)");
    expect(formatted.message).toContain("MWAC");
    expect(formatted.action?.href).toBe(SETTINGS_LOCATIONS_HREF);
  });

  it("formats opening balance errors with stock module link", () => {
    const formatted = formatStockAdjustmentRpcError(
      "opening balance requires zero on-hand for variant abc at this location",
      { locationName: "NSP Branch" }
    );

    expect(formatted.message).toContain("NSP Branch");
    expect(formatted.action).toEqual({
      href: STOCK_HREF,
      label: "Open Stock",
    });
  });
});
