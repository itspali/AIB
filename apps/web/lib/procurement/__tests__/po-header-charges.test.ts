import { describe, expect, it } from "vitest";
import {
  emptyPoHeaderCharges,
  normalizePoHeaderChargesForSave,
  normalizePoHeaderChargesFromStorage,
  resolvePoShippingTaxAmount,
} from "@/lib/procurement/purchase-orders/po-header-charges";

describe("po header charges", () => {
  it("computes shipping tax from percent of shipping amount", () => {
    expect(
      resolvePoShippingTaxAmount({
        ...emptyPoHeaderCharges(),
        shipping_amount: "100",
        shipping_tax_rate_pct: "18",
      })
    ).toBe(18);
  });

  it("returns zero when shipping amount is zero", () => {
    expect(
      resolvePoShippingTaxAmount({
        ...emptyPoHeaderCharges(),
        shipping_amount: "0",
        shipping_tax_rate_pct: "18",
      })
    ).toBe(0);
  });

  it("coerces legacy amount mode to percent rate on load", () => {
    expect(
      normalizePoHeaderChargesFromStorage({
        ...emptyPoHeaderCharges(),
        shipping_amount: "200",
        shipping_tax_amount: "36",
        shipping_tax_type: "amount",
      })
    ).toEqual(
      expect.objectContaining({
        shipping_tax_rate_pct: "18",
        shipping_tax_type: "percent",
      })
    );
  });

  it("normalizes shipping tax for save as percent with computed amount", () => {
    const normalized = normalizePoHeaderChargesForSave({
      ...emptyPoHeaderCharges(),
      shipping_amount: "100",
      shipping_tax_rate_pct: "10",
    });

    expect(normalized.shipping_tax_type).toBe("percent");
    expect(normalized.shipping_tax_amount).toBe(10);
    expect(normalized.shipping_tax_rate_pct).toBe(10);
  });
});
