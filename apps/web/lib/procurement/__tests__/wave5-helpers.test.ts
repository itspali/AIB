import { describe, expect, it } from "vitest";
import {
  grnHasImportTaxContext,
  grnLineHasImportTax,
  sumGrnLineImportTax,
} from "@/lib/procurement/goods-receipts/grn-import-tax";
import type { GoodsReceiptLineRow, GoodsReceiptRow } from "@/lib/procurement/goods-receipts/types";
import {
  isPromoBalanceEligibleForReclassification,
  promotionalBatchStatusLabel,
  sumSelectedPromoBalanceQty,
} from "@/lib/procurement/promo/reclassification-helpers";
import type { PromoInventoryBalanceRow } from "@/lib/inventory/stock/promo-balances";

function line(
  patch: Partial<GoodsReceiptLineRow> = {}
): GoodsReceiptLineRow {
  return {
    id: "line-1",
    item_id: "item-1",
    item_name: "Widget",
    variant_id: "var-1",
    variant_sku: "W-1",
    po_item_id: null,
    quantity_received: "1",
    quantity_accepted: "1",
    quantity_rejected: "0",
    raw_unit_cost: "10",
    total_final_landed_cost: "10",
    import_igst_amount: "0",
    customs_duty_amount: "0",
    ...patch,
  };
}

function receipt(
  patch: Partial<GoodsReceiptRow> = {}
): GoodsReceiptRow {
  return {
    id: "grn-1",
    voucher_number: "GRN-00001",
    destination_location_id: "loc-1",
    destination_location_name: "Main",
    destination_location_code: "MAIN",
    purchase_order_id: null,
    purchase_order_number: null,
    is_qc_pending: false,
    line_count: 1,
    received_at: "2026-06-12T00:00:00Z",
    created_at: "2026-06-12T00:00:00Z",
    bill_of_entry_number: null,
    bill_of_entry_date: null,
    port_code: null,
    exchange_rate: null,
    assessable_value: null,
    customs_duty_amount: null,
    import_igst_amount: null,
    lines: [line()],
    ...patch,
  };
}

describe("grn import tax helpers", () => {
  it("detects import tax context from header amounts", () => {
    expect(grnHasImportTaxContext(receipt())).toBe(false);
    expect(grnHasImportTaxContext(receipt({ import_igst_amount: "180" }))).toBe(true);
  });

  it("detects import tax context from line amounts", () => {
    expect(
      grnHasImportTaxContext(
        receipt({ lines: [line({ customs_duty_amount: "50" })] })
      )
    ).toBe(true);
  });

  it("sums line import tax totals", () => {
    expect(
      sumGrnLineImportTax([
        line({ import_igst_amount: "100", customs_duty_amount: "20" }),
        line({ id: "line-2", import_igst_amount: "50", customs_duty_amount: "5" }),
      ])
    ).toEqual({ importIgst: 150, customsDuty: 25 });
  });

  it("detects line-level import tax", () => {
    expect(grnLineHasImportTax(line())).toBe(false);
    expect(grnLineHasImportTax(line({ import_igst_amount: "1" }))).toBe(true);
  });
});

function promoBalance(
  patch: Partial<PromoInventoryBalanceRow> = {}
): PromoInventoryBalanceRow {
  return {
    id: "bal-1",
    location_id: "loc-1",
    location_name: "Main",
    item_id: "item-1",
    item_name: "Sample",
    variant_id: "var-1",
    variant_sku: "S-1",
    quantity_on_hand: "5",
    quarantine_type: "PROMOTIONAL_HOLD",
    promotional_batch_id: null,
    ...patch,
  };
}

describe("promo reclassification helpers", () => {
  it("allows balances with qty and no batch link", () => {
    expect(isPromoBalanceEligibleForReclassification(promoBalance())).toBe(true);
    expect(
      isPromoBalanceEligibleForReclassification(promoBalance({ quantity_on_hand: "0" }))
    ).toBe(false);
    expect(
      isPromoBalanceEligibleForReclassification(
        promoBalance({ promotional_batch_id: "batch-1" })
      )
    ).toBe(false);
  });

  it("sums selected balance quantities", () => {
    expect(
      sumSelectedPromoBalanceQty(
        [promoBalance(), promoBalance({ id: "bal-2", quantity_on_hand: "2" })],
        new Set(["bal-2"])
      )
    ).toBe(2);
  });

  it("labels batch statuses", () => {
    expect(promotionalBatchStatusLabel("DRAFT")).toBe("Draft");
  });
});
