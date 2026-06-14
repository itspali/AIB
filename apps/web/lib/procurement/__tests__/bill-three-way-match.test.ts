import { describe, expect, it } from "vitest";
import {
  aggregateGrnQuantitiesByPoItem,
  buildBillDraftLinesFromPo,
  validateBillDraftLineQuantities,
} from "@/lib/procurement/bills/bill-draft-form";
import {
  aggregateBillMatchSeverity,
  computePriceVariancePct,
  computeQuantityOverage,
  computeQuantityVariancePct,
  resolveBillLineMatchSeverity,
  resolveBillLineQuantitySeverity,
} from "@/lib/procurement/bills/three-way-match";

describe("three-way match helpers", () => {
  it("computes variance percent against PO rate", () => {
    expect(computePriceVariancePct(105, 100)).toBe(5);
  });

  it("flags hold when variance exceeds tolerance", () => {
    expect(resolveBillLineMatchSeverity(5, 2)).toBe("hold");
    expect(resolveBillLineMatchSeverity(1, 2)).toBe("variance");
    expect(resolveBillLineMatchSeverity(0, 2)).toBe("matched");
  });

  it("aggregates worst line severity", () => {
    expect(
      aggregateBillMatchSeverity(["matched", "variance", "matched"], 2)
    ).toBe("VARIANCE");
    expect(aggregateBillMatchSeverity(["matched", "hold"], 2)).toBe("PPV_HOLD");
  });

  it("detects quantity overage against GRN accepted qty", () => {
    expect(computeQuantityOverage(9, 8)).toBe(1);
    expect(computeQuantityOverage(8, 8)).toBe(0);
    expect(resolveBillLineQuantitySeverity(9, 8)).toBe("overage");
    expect(resolveBillLineQuantitySeverity(8, 8)).toBe("matched");
    expect(computeQuantityVariancePct(9, 8)).toBeCloseTo(12.5, 4);
  });

  it("respects quantity already invoiced on the PO line", () => {
    expect(computeQuantityOverage(5, 8, 4)).toBe(1);
    expect(resolveBillLineQuantitySeverity(5, 8, 4)).toBe("overage");
    expect(resolveBillLineQuantitySeverity(4, 8, 4)).toBe("matched");
  });

  it("validates draft line quantities", () => {
    expect(
      validateBillDraftLineQuantities([
        {
          key: "1",
          po_item_id: "po-1",
          variant_id: "var-1",
          item_id: "item-1",
          item_name: "Widget",
          variant_sku: "W-1",
          quantity_billed: "9",
          unit_price_billed: "100",
          po_unit_price: "100",
          grn_landed_unit_cost: null,
          quantity_on_grns: "8",
          quantity_already_invoiced: "0",
        },
      ])
    ).toMatch(/exceeds remaining billable quantity/);
  });
});

describe("buildBillDraftLinesFromPo", () => {
  it("aggregates accepted quantities and landed cost from selected GRNs", () => {
    const order = {
      id: "po-1",
      voucher_number: "PO-1",
      supplier_id: "sup-1",
      destination_location_id: "loc-1",
      destination_location_name: "Main",
      destination_location_code: "MAIN",
      supplier_name: "Vendor",
      tax_supply_nature: "INTERSTATE" as const,
      currency_code: "INR",
      lines: [
        {
          id: "po-line-1",
          item_id: "item-1",
          item_name: "Widget",
          variant_id: "var-1",
          variant_sku: "W-1",
          quantity_ordered: "10",
          quantity_received: "8",
          quantity_invoiced: "2",
          unit_price_contractual: "100",
          discount_percentage: "0",
          discount_amount: "0",
          line_tax_amount: "0",
          tax_rate_percentage: "0",
          tax_components: [],
          uom_code: "PCS",
          uom_conversion_factor: "1",
          line_total_gross: "800",
          open_quantity: "2",
          is_promotional: false,
        },
      ],
    };

    const grns = [
      {
        id: "grn-1",
        voucher_number: "GRN-1",
        destination_location_id: "loc-1",
        destination_location_name: "Main",
        destination_location_code: "MAIN",
        purchase_order_id: "po-1",
        purchase_order_number: "PO-1",
        is_qc_pending: false,
        line_count: 1,
        received_at: "2026-06-01T00:00:00.000Z",
        created_at: "2026-06-01T00:00:00.000Z",
        lines: [
          {
            id: "grn-line-1",
            item_id: "item-1",
            item_name: "Widget",
            variant_id: "var-1",
            variant_sku: "W-1",
            po_item_id: "po-line-1",
            quantity_received: "5",
            quantity_accepted: "5",
            quantity_rejected: "0",
            raw_unit_cost: "100",
            total_final_landed_cost: "110",
            import_igst_amount: "0",
            customs_duty_amount: "0",
          },
        ],
      },
      {
        id: "grn-2",
        voucher_number: "GRN-2",
        destination_location_id: "loc-1",
        destination_location_name: "Main",
        destination_location_code: "MAIN",
        purchase_order_id: "po-1",
        purchase_order_number: "PO-1",
        is_qc_pending: false,
        line_count: 1,
        received_at: "2026-06-02T00:00:00.000Z",
        created_at: "2026-06-02T00:00:00.000Z",
        lines: [
          {
            id: "grn-line-2",
            item_id: "item-1",
            item_name: "Widget",
            variant_id: "var-1",
            variant_sku: "W-1",
            po_item_id: "po-line-1",
            quantity_received: "3",
            quantity_accepted: "3",
            quantity_rejected: "0",
            raw_unit_cost: "100",
            total_final_landed_cost: "130",
            import_igst_amount: "0",
            customs_duty_amount: "0",
          },
        ],
      },
    ];

    const aggregates = aggregateGrnQuantitiesByPoItem(grns, ["grn-1", "grn-2"]);
    expect(aggregates.get("po-line-1")?.quantity_accepted).toBe(8);
    expect(aggregates.get("po-line-1")?.weighted_landed_cost).toBeCloseTo(117.5, 4);

    const draftLines = buildBillDraftLinesFromPo(order, grns, ["grn-1", "grn-2"]);
    expect(draftLines).toHaveLength(1);
    expect(draftLines[0]?.quantity_billed).toBe("6");
    expect(draftLines[0]?.quantity_already_invoiced).toBe("2");
    expect(draftLines[0]?.unit_price_billed).toBe("100");
    expect(Number(draftLines[0]?.grn_landed_unit_cost)).toBeCloseTo(117.5, 4);
  });

  it("prefers quantity_accepted over quantity_received on GRN lines", () => {
    const grns = [
      {
        id: "grn-1",
        voucher_number: "GRN-1",
        destination_location_id: "loc-1",
        destination_location_name: "Main",
        destination_location_code: "MAIN",
        purchase_order_id: "po-1",
        purchase_order_number: "PO-1",
        is_qc_pending: true,
        line_count: 1,
        received_at: "2026-06-01T00:00:00.000Z",
        created_at: "2026-06-01T00:00:00.000Z",
        lines: [
          {
            id: "grn-line-1",
            item_id: "item-1",
            item_name: "Widget",
            variant_id: "var-1",
            variant_sku: "W-1",
            po_item_id: "po-line-1",
            quantity_received: "10",
            quantity_accepted: "7",
            quantity_rejected: "3",
            raw_unit_cost: "100",
            total_final_landed_cost: "100",
            import_igst_amount: "0",
            customs_duty_amount: "0",
          },
        ],
      },
    ];

    const aggregates = aggregateGrnQuantitiesByPoItem(grns, ["grn-1"]);
    expect(aggregates.get("po-line-1")?.quantity_accepted).toBe(7);
  });
});
