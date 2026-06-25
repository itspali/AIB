import { describe, expect, it } from "vitest";
import { resolveShipmentPrefillFromPo } from "@/lib/procurement/shipments/prefill-from-po";
import type { AllocatableImportPurchaseOrderOption } from "@/lib/procurement/shipments/types";

const baseOrder: AllocatableImportPurchaseOrderOption = {
  id: "po-1",
  voucher_number: "PO-2026-00001",
  supplier_id: "sup-1",
  supplier_name: "Overseas Supplier",
  destination_location_id: "loc-cha",
  destination_location_name: "CHA",
  receipt_location_id: "loc-cha",
  ultimate_destination_location_id: "loc-ho",
  lines: [
    {
      id: "line-1",
      variant_id: "var-1",
      item_id: "item-1",
      item_name: "Cargo Pant",
      variant_sku: "CP001",
      open_quantity: "50",
      unit_price_contractual: "1000",
      is_promotional: false,
    },
  ],
};

describe("resolveShipmentPrefillFromPo", () => {
  it("prefills staging, ultimate, supplier, incoterms, and lines", () => {
    const result = resolveShipmentPrefillFromPo(baseOrder, [
      {
        id: "sup-1",
        name: "Overseas Supplier",
        payment_terms_days: 30,
        base_currency_override: null,
        billing_state: null,
        billing_country_code: "US",
        tax_treatment: "REGULAR_B2B",
        incoterms_code: "FOB",
      },
    ]);

    expect(result.supplierId).toBe("sup-1");
    expect(result.stagingLocationId).toBe("loc-cha");
    expect(result.ultimateDestinationLocationId).toBe("loc-ho");
    expect(result.incotermsCode).toBe("FOB");
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]?.quantity_shipped).toBe("50");
  });

  it("falls back to destination when receipt and ultimate are empty", () => {
    const result = resolveShipmentPrefillFromPo(
      {
        ...baseOrder,
        receipt_location_id: null,
        ultimate_destination_location_id: null,
      },
      []
    );

    expect(result.stagingLocationId).toBe("loc-cha");
    expect(result.ultimateDestinationLocationId).toBe("loc-cha");
  });
});
