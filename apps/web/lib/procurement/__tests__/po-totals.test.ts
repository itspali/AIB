import { describe, expect, it } from "vitest";
import {
  computeLineGross,
  computePurchaseOrderTotals,
  resolveLineDiscount,
} from "@/lib/procurement/purchase-orders/totals";

describe("purchase order totals", () => {
  it("sums line gross amounts for valid qty and price", () => {
    const totals = computePurchaseOrderTotals([
      { quantity_ordered: "2", unit_price_contractual: "10" },
      { quantity_ordered: "1.5", unit_price_contractual: "4" },
    ]);

    expect(totals.subtotalGross).toBe(26);
    expect(totals.grandTotal).toBe(26);
    expect(totals.filledLineCount).toBe(2);
  });

  it("returns zero for empty qty", () => {
    expect(computeLineGross({ quantity_ordered: "", unit_price_contractual: "12" })).toBe(0);
  });

  it("parses comma-formatted unit prices when applying discount", () => {
    const line = {
      quantity_ordered: "10",
      unit_price_contractual: "1,800.50",
      discount_percentage: "10",
      discount_amount: "0",
      discount_type: "percent" as const,
    };

    expect(resolveLineDiscount(line)).toBe(1800.5);
    expect(computeLineGross(line)).toBe(16204.5);
  });

  it("applies percent discount to line gross", () => {
    const line = {
      quantity_ordered: "10",
      unit_price_contractual: "100",
      discount_percentage: "10",
      discount_amount: "0",
    };

    expect(resolveLineDiscount(line)).toBe(100);
    expect(computeLineGross(line)).toBe(900);
  });

  it("prefers fixed discount amount over percent when type is amount", () => {
    const line = {
      quantity_ordered: "2",
      unit_price_contractual: "50",
      discount_percentage: "50",
      discount_amount: "25",
      discount_type: "amount" as const,
    };

    expect(computeLineGross(line)).toBe(75);
  });

  it("uses percent discount when type is percent even if amount is stored", () => {
    const line = {
      quantity_ordered: "2",
      unit_price_contractual: "50",
      discount_percentage: "10",
      discount_amount: "25",
      discount_type: "percent" as const,
    };

    expect(resolveLineDiscount(line)).toBe(10);
    expect(computeLineGross(line)).toBe(90);
  });

  it("caps discount at line extension", () => {
    const line = {
      quantity_ordered: "1",
      unit_price_contractual: "10",
      discount_amount: "99",
    };

    expect(computeLineGross(line)).toBe(0);
  });

  it("includes line tax in totals when item tax rate is known", () => {
    const totals = computePurchaseOrderTotals(
      [
        {
          quantity_ordered: "2",
          unit_price_contractual: "100",
          catalog_context: {
            description: null,
            hsn_sac_code: null,
            base_unit_of_measure: "PCS",
            image_url: null,
            tax_code_id: "tax-1",
            tax_rate: 18,
            tax_is_variable: false,
            custom_fields: {},
            variant_attributes: {},
            attribute_labels: {},
            catalog_snapshot_source: "server",
          },
        },
      ],
      { purchasePricesTaxInclusive: false }
    );

    expect(totals.subtotalGross).toBe(200);
    expect(totals.taxAmount).toBe(36);
    expect(totals.grandTotal).toBe(236);
  });

  it("includes document-level charges in grand total", () => {
    const totals = computePurchaseOrderTotals(
      [{ quantity_ordered: "1", unit_price_contractual: "100" }],
      {
        headerCharges: {
          shipping_amount: "10",
          shipping_tax_rate_pct: "18",
          shipping_tax_amount: "0",
          shipping_tax_type: "percent",
          round_off_amount: "0.50",
          additional_charges_amount: "5",
        },
      }
    );

    expect(totals.subtotalGross).toBe(100);
    expect(totals.shippingAmount).toBe(10);
    expect(totals.shippingTaxAmount).toBe(1.8);
    expect(totals.additionalChargesAmount).toBe(5);
    expect(totals.roundOffAmount).toBe(0.5);
    expect(totals.grandTotal).toBe(117.3);
  });
});
