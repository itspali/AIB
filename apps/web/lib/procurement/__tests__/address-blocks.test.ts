import { describe, expect, it } from "vitest";
import { resolvePurchaseOrderAddressBlocks } from "@/lib/procurement/purchase-orders/address-blocks";
import { formatPostalAddressLines } from "@/lib/procurement/purchase-orders/postal-address";

describe("formatPostalAddressLines", () => {
  it("formats a multi-line postal address", () => {
    expect(
      formatPostalAddressLines({
        address_line1: "Plot 8",
        address_line2: "Logistics Park",
        city: "Mumbai",
        state: "MH",
        zip_postal: "400001",
        country_code: "IN",
      })
    ).toEqual(["Plot 8", "Logistics Park", "Mumbai, MH 400001", "IN"]);
  });
});

describe("resolvePurchaseOrderAddressBlocks", () => {
  it("returns vendor, ship to, and bill to blocks", () => {
    const blocks = resolvePurchaseOrderAddressBlocks({
      supplier_name: "Acme",
      supplier_address: {
        name: "Acme Supplies",
        address_line1: "12 Industrial Estate",
        address_line2: null,
        city: "Pune",
        state: "MH",
        zip_postal: "411045",
        country_code: "IN",
        tax_identifier: "GST-ACME",
      },
      destination_location_name: "Main warehouse",
      destination_address: {
        name: "Main warehouse",
        address_line1: "Plot 8",
        address_line2: null,
        city: "Mumbai",
        state: "MH",
        zip_postal: "400001",
        country_code: "IN",
        tax_identifier: "GST-WH",
      },
      organization_bill_to: {
        name: "Demo Org",
        address_line1: "100 Tower",
        address_line2: null,
        city: "Mumbai",
        state: "MH",
        zip_postal: "400051",
        country_code: "IN",
        tax_identifier: "GST-ORG",
      },
    });

    expect(blocks.map((block) => block.kind)).toEqual(["vendor", "ship_to", "bill_to"]);
    expect(blocks[0]?.tax_identifier).toBe("GST-ACME");
    expect(blocks[1]?.title).toBe("Ship to");
    expect(blocks[2]?.title).toBe("Bill to");
  });

  it("prefers tax registered name for ship to display name", () => {
    const blocks = resolvePurchaseOrderAddressBlocks({
      supplier_name: "Acme",
      supplier_address: null,
      destination_location_name: "Main warehouse",
      destination_address: {
        name: "Registered Branch Name",
        address_line1: "Plot 8",
        address_line2: null,
        city: "Mumbai",
        state: "MH",
        zip_postal: "400001",
        country_code: "IN",
        tax_identifier: null,
      },
      organization_bill_to: {
        name: "Demo Org",
        address_line1: null,
        address_line2: null,
        city: null,
        state: null,
        zip_postal: null,
        country_code: null,
        tax_identifier: null,
      },
    });

    expect(blocks.find((block) => block.kind === "ship_to")?.name).toBe("Registered Branch Name");
  });
});
