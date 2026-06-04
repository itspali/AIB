import { describe, expect, it } from "vitest";
import {
  buildReservedCatalogCustomFieldsPayload,
  extractDefaultPurchasePriceFromCustomFieldsRecord,
  extractDefaultSellingPriceFromCustomFieldsRecord,
  extractMrpFromCustomFieldsRecord,
} from "@/lib/products/catalog-reserved-fields";

describe("catalog reserved fields", () => {
  it("round-trips MRP and default prices through custom_fields JSON", () => {
    const payload = buildReservedCatalogCustomFieldsPayload({
      mrp: "199.00",
      selling_price: "150",
      purchase_price: "90",
      supplier_id: null,
    });

    expect(payload.mrp).toBe("199.00");
    expect(payload._default_selling_price).toBe("150");
    expect(payload._default_purchase_price).toBe("90");

    expect(extractMrpFromCustomFieldsRecord(payload)).toBe("199.00");
    expect(extractDefaultSellingPriceFromCustomFieldsRecord(payload)).toBe("150");
    expect(extractDefaultPurchasePriceFromCustomFieldsRecord(payload)).toBe("90");
  });
});
