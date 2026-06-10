import { describe, expect, it } from "vitest";
import {
  emptyPoHeaderCharges,
  normalizePoHeaderChargesForSave,
  resolvePoShippingTaxAmount,
  resolvePoShippingTaxType,
} from "@/lib/procurement/purchase-orders/po-header-charges";

describe("po header charges", () => {
  it("computes shipping tax from percent", () => {
    expect(
      resolvePoShippingTaxAmount({
        ...emptyPoHeaderCharges(),
        shipping_amount: "100",
        shipping_tax_rate_pct: "18",
        shipping_tax_type: "percent",
      })
    ).toBe(18);
  });

  it("uses fixed shipping tax amount in amount mode", () => {
    expect(
      resolvePoShippingTaxAmount({
        ...emptyPoHeaderCharges(),
        shipping_amount: "100",
        shipping_tax_amount: "12.5",
        shipping_tax_type: "amount",
      })
    ).toBe(12.5);
  });

  it("infers amount mode when only amount is set", () => {
    expect(
      resolvePoShippingTaxType({
        shipping_amount: "0",
        shipping_tax_rate_pct: "0",
        shipping_tax_amount: "5",
        round_off_amount: "0",
        additional_charges_amount: "0",
      })
    ).toBe("amount");
  });

  it("normalizes shipping tax for save in percent mode", () => {
    const normalized = normalizePoHeaderChargesForSave({
      ...emptyPoHeaderCharges(),
      shipping_amount: "100",
      shipping_tax_rate_pct: "10",
      shipping_tax_type: "percent",
    });

    expect(normalized.shipping_tax_type).toBe("percent");
    expect(normalized.shipping_tax_amount).toBe(10);
    expect(normalized.shipping_tax_rate_pct).toBe(10);
  });
});
