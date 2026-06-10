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

  it("prefers fixed discount amount over percent", () => {
    const line = {
      quantity_ordered: "2",
      unit_price_contractual: "50",
      discount_percentage: "50",
      discount_amount: "25",
    };

    expect(computeLineGross(line)).toBe(75);
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
});
