import { describe, expect, it } from "vitest";
import { formatGoodsReceiptRpcError } from "@/lib/procurement/goods-receipts/rpc-errors";
import { PROCUREMENT_PO_HREF, SETTINGS_LOCATIONS_HREF } from "@/lib/procurement/navigation";

describe("grn rpc-errors", () => {
  it("formats GRN document numbering errors with settings link", () => {
    const formatted = formatGoodsReceiptRpcError(
      "document prefix not configured for GOODS_RECEIPT_NOTE at location 9952be31-7686-450e-a86c-f7f4253e8b5a",
      {
        locationId: "9952be31-7686-450e-a86c-f7f4253e8b5a",
        locationName: "Head Office",
        locationCode: "HO",
      }
    );

    expect(formatted.message).toContain("Head Office (HO)");
    expect(formatted.message).toContain("GRN");
    expect(formatted.action).toEqual({
      href: SETTINGS_LOCATIONS_HREF,
      label: "Open Locations settings",
    });
  });

  it("formats PO quantity errors with purchase orders link", () => {
    const formatted = formatGoodsReceiptRpcError(
      "quantity_received exceeds open purchase order quantity for line abc"
    );

    expect(formatted.message).toContain("open amount");
    expect(formatted.action).toEqual({
      href: PROCUREMENT_PO_HREF,
      label: "Review purchase order",
    });
  });

  it("formats tracking mode errors for goods receipts", () => {
    const formatted = formatGoodsReceiptRpcError(
      "lot and serial tracking are not supported in goods receipts yet"
    );

    expect(formatted.message).toContain("quantity-tracked");
  });
});
