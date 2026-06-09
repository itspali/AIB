import { describe, expect, it } from "vitest";
import { VARIANT_ATTRIBUTES_ALL_ID } from "@/lib/documents/catalog-field-ids";
import {
  resolveCatalogLineFieldDisplay,
  type PoLineCatalogContext,
} from "@/lib/documents/catalog-line-values";
import { createPoCatalogFieldPref } from "@/lib/documents/purchase-order-layout";

const sampleContext: PoLineCatalogContext = {
  description: "Widget assembly",
  hsn_sac_code: "8471",
  base_unit_of_measure: "EA",
  image_url: "https://cdn.example/item.jpg",
  custom_fields: { brand: "Acme" },
  variant_attributes: { Color: "Red", Size: "L" },
  attribute_labels: { Color: "Colour", Size: "Size" },
};

describe("resolveCatalogLineFieldDisplay", () => {
  it("resolves item columns and custom fields", () => {
    expect(
      resolveCatalogLineFieldDisplay(
        createPoCatalogFieldPref("item_column", "hsn_sac_code", "HSN/SAC"),
        sampleContext
      )
    ).toBe("8471");
    expect(
      resolveCatalogLineFieldDisplay(
        createPoCatalogFieldPref("item_custom_field", "brand"),
        sampleContext
      )
    ).toBe("Acme");
  });

  it("formats all variant attributes with category labels", () => {
    expect(
      resolveCatalogLineFieldDisplay(
        createPoCatalogFieldPref("variant_attributes_all", "__all__"),
        sampleContext
      )
    ).toBe("Colour: Red · Size: L");
  });

  it("resolves a single variant attribute", () => {
    expect(
      resolveCatalogLineFieldDisplay(
        createPoCatalogFieldPref("variant_attribute", "Color"),
        sampleContext
      )
    ).toBe("Red");
  });

  it("returns null when context is missing", () => {
    expect(
      resolveCatalogLineFieldDisplay(
        { id: VARIANT_ATTRIBUTES_ALL_ID, label: "Variant", defaultVisible: true },
        null
      )
    ).toBeNull();
  });
});
