import { describe, expect, it } from "vitest";
import {
  grnLineQcHoldQuantity,
  grnLinesAwaitingQcRelease,
  parseGrnQcReleaseQuantities,
  syncGrnQcPassQuantity,
  syncGrnQcRejectQuantity,
} from "@/lib/procurement/goods-receipts/grn-qc-release";
import type { GoodsReceiptLineRow } from "@/lib/procurement/goods-receipts/types";

function line(partial: Partial<GoodsReceiptLineRow> & Pick<GoodsReceiptLineRow, "id">): GoodsReceiptLineRow {
  return {
    item_id: "item-1",
    item_name: "Widget",
    variant_id: "variant-1",
    variant_sku: "SKU-1",
    po_item_id: null,
    quantity_received: "10",
    quantity_accepted: "10",
    quantity_rejected: "0",
    raw_unit_cost: "100",
    total_final_landed_cost: "1000",
    import_igst_amount: "0",
    customs_duty_amount: "0",
    ...partial,
  };
}

describe("grnLineQcHoldQuantity", () => {
  it("prefers quantity_on_qc_hold when present", () => {
    expect(
      grnLineQcHoldQuantity(
        line({ id: "line-1", quantity_accepted: "10", quantity_on_qc_hold: "3" })
      )
    ).toBe(3);
  });
});

describe("grnLinesAwaitingQcRelease", () => {
  it("includes lines missing QC hold rows when accepted quantity remains", () => {
    expect(
      grnLinesAwaitingQcRelease([
        line({ id: "line-1", quantity_accepted: "2" }),
        line({ id: "line-2", quantity_accepted: "10" }),
      ])
    ).toHaveLength(2);
  });

  it("excludes lines explicitly not routed to QC", () => {
    expect(
      grnLinesAwaitingQcRelease([
        line({ id: "line-1", quantity_accepted: "2" }),
        line({ id: "line-2", quantity_accepted: "10", route_to_qc: false }),
      ])
    ).toHaveLength(1);
  });
});

describe("parseGrnQcReleaseQuantities", () => {
  it("rejects pass plus reject above on hold", () => {
    expect(parseGrnQcReleaseQuantities(10, "10", "2").error).toMatch(/cannot exceed/i);
  });

  it("defaults pass to on hold when blank", () => {
    expect(parseGrnQcReleaseQuantities(10, "", "0")).toEqual({ pass: 10, reject: 0 });
  });
});

describe("syncGrnQcPassQuantity", () => {
  it("sets reject to the remaining on-hold quantity", () => {
    expect(syncGrnQcPassQuantity(10, "7")).toEqual({ pass: "7", reject: "3" });
  });

  it("clamps pass to on hold", () => {
    expect(syncGrnQcPassQuantity(10, "12")).toEqual({ pass: "10", reject: "0" });
  });
});

describe("syncGrnQcRejectQuantity", () => {
  it("sets pass to the remaining on-hold quantity", () => {
    expect(syncGrnQcRejectQuantity(10, "2")).toEqual({ pass: "8", reject: "2" });
  });
});
