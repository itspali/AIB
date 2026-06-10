import { describe, expect, it } from "vitest";
import { mergePoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import { resolveCommercialLineDetailDisplay } from "@/lib/documents/line-detail-display";
import type { DocumentColumnPref } from "@/lib/documents/types";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";

const unitPriceColumn: DocumentColumnPref = {
  id: "unit_price",
  label: "Unit price (ex tax)",
  defaultVisible: true,
  group: "line",
  lineSlot: "item_detail",
  decimalPlaces: 2,
};

const sampleLine: PoDraftLine = {
  key: "line-1",
  sku: "SKU-1",
  variant_id: "variant-1",
  item_id: "item-1",
  item_name: "Widget",
  variant_sku: "SKU-1",
  quantity_ordered: "2",
  unit_price_contractual: "12.5",
  skuError: null,
};

describe("line-detail-display", () => {
  it("formats unit price for item-detail rows", () => {
    expect(resolveCommercialLineDetailDisplay(unitPriceColumn, sampleLine)).toBe("12.50");
  });

  it("formats mrp from catalog context", () => {
    expect(
      resolveCommercialLineDetailDisplay(
        { id: "mrp", label: "MRP", defaultVisible: true, group: "line", decimalPlaces: 2 },
        {
          ...sampleLine,
          catalog_context: {
            description: null,
            hsn_sac_code: null,
            base_unit_of_measure: "EA",
            mrp: "99.5",
            image_url: null,
            tax_code_id: null,
            tax_rate: 0,
            tax_is_variable: false,
            default_purchase_uom: null,
            alternate_uoms: [],
            custom_fields: {},
            variant_attributes: {},
            attribute_labels: {},
          },
        }
      )
    ).toBe("99.50");
  });

  it("resolves sku from variant_sku", () => {
    expect(
      resolveCommercialLineDetailDisplay(
        { id: "sku", label: "SKU", defaultVisible: true, group: "line" },
        sampleLine
      )
    ).toBe("SKU-1");
  });

  it("respects column decimal places for line total", () => {
    expect(
      resolveCommercialLineDetailDisplay(
        { ...unitPriceColumn, id: "line_total", label: "Line total", decimalPlaces: 0 },
        sampleLine
      )
    ).toBe("25");
  });

  it("returns null for commercial detail fields without a variant", () => {
    expect(
      resolveCommercialLineDetailDisplay(unitPriceColumn, {
        ...sampleLine,
        variant_id: "",
      })
    ).toBeNull();
  });
});

describe("mergePoLineCatalogContext", () => {
  it("keeps optimistic image when server context is missing", () => {
    const merged = mergePoLineCatalogContext(null, null, "https://cdn.example/item.jpg");
    expect(merged?.image_url).toBe("https://cdn.example/item.jpg");
  });

  it("prefers server image but keeps client fallback when server has none", () => {
    const merged = mergePoLineCatalogContext(
      { image_url: "https://cdn.example/client.jpg" } as never,
      {
        description: "Test",
        hsn_sac_code: null,
        base_unit_of_measure: "EA",
        image_url: null,
        custom_fields: {},
        variant_attributes: {},
        attribute_labels: {},
        catalog_snapshot_source: "server",
      },
      "https://cdn.example/client.jpg"
    );

    expect(merged?.image_url).toBe("https://cdn.example/client.jpg");
    expect(merged?.description).toBe("Test");
  });
});
