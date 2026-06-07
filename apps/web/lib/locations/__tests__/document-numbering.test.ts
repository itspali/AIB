import { describe, expect, it } from "vitest";
import {
  filterNamingSequencesToKeys,
  getLocationDocumentNumberingKeys,
  locationHasDocumentNumbering,
} from "@/lib/locations/document-numbering";

describe("document-numbering", () => {
  it("returns procurement and transfer keys for stock-holding locations", () => {
    expect(
      getLocationDocumentNumberingKeys({
        is_stock_holding: true,
        is_commercial_storefront: false,
        is_administrative_office: false,
      })
    ).toEqual([
      "PURCHASE_ORDER",
      "GOODS_RECEIPT_NOTE",
      "PURCHASE_INVOICE",
      "STOCK_TRANSFER",
      "STOCK_ADJUSTMENT",
    ]);
  });

  it("returns sales keys for commercial storefront locations", () => {
    expect(
      getLocationDocumentNumberingKeys({
        is_stock_holding: false,
        is_commercial_storefront: true,
        is_administrative_office: false,
      })
    ).toEqual([
      "SALES_QUOTATION",
      "SALES_ORDER",
      "SALES_INVOICE",
      "CUSTOMER_PAYMENT",
      "SALES_CREDIT_NOTE",
    ]);
  });

  it("returns GL for administrative office locations", () => {
    expect(
      getLocationDocumentNumberingKeys({
        is_stock_holding: false,
        is_commercial_storefront: false,
        is_administrative_office: true,
      })
    ).toEqual(["GENERAL_LEDGER"]);
  });

  it("returns the union for combined capabilities", () => {
    const keys = getLocationDocumentNumberingKeys({
      is_stock_holding: true,
      is_commercial_storefront: true,
      is_administrative_office: true,
    });

    expect(keys).toContain("PURCHASE_ORDER");
    expect(keys).toContain("SALES_INVOICE");
    expect(keys).toContain("GENERAL_LEDGER");
    expect(keys).toHaveLength(11);
  });

  it("returns no keys for manufacturing-only locations", () => {
    expect(
      getLocationDocumentNumberingKeys({
        is_stock_holding: false,
        is_commercial_storefront: false,
        is_administrative_office: false,
      })
    ).toEqual([]);
    expect(
      locationHasDocumentNumbering({
        is_stock_holding: false,
        is_commercial_storefront: false,
        is_administrative_office: false,
      })
    ).toBe(false);
  });

  it("filters naming sequences to allowed keys", () => {
    const filtered = filterNamingSequencesToKeys(
      {
        PURCHASE_ORDER: { prefix: "PO-", digits: "5" },
        SALES_INVOICE: { prefix: "SI-", digits: "5" },
        GENERAL_LEDGER: { prefix: "GL-", digits: "5" },
      },
      ["PURCHASE_ORDER", "GOODS_RECEIPT_NOTE"]
    );

    expect(filtered).toEqual({
      PURCHASE_ORDER: { prefix: "PO-", digits: "5" },
    });
  });
});
