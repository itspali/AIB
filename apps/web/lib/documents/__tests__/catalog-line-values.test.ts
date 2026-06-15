import { describe, expect, it } from "vitest";
import { VARIANT_ATTRIBUTES_ALL_ID } from "@/lib/documents/catalog-field-ids";
import {
  createOptimisticPoLineCatalogContextFromPicker,
  emptyPoLineCatalogContext,
  mergePoLineCatalogContext,
  needsPoLineCatalogHydration,
  resolveCatalogLineFieldDisplay,
  type PoLineCatalogContext,
} from "@/lib/documents/catalog-line-values";
import { createPoCatalogFieldPref } from "@/lib/documents/purchase-order-layout";
import { COMMERCE_DEFAULT_PURCHASE_UOM_KEY } from "@/lib/products/item-uom-commerce";

const sampleContext: PoLineCatalogContext = {
  description: "Widget assembly",
  hsn_sac_code: "8471",
  base_unit_of_measure: "EA",
  mrp: "120",
  image_url: "https://cdn.example/item.jpg",
  tax_code_id: null,
  tax_rate: 0,
  tax_is_variable: false,
  price_is_tax_inclusive: false,
  tax_components: [],
  purchase_price: null,
  selling_price: null,
  default_purchase_uom: null,
  default_selling_uom: null,
  alternate_uoms: [],
  custom_fields: { brand: "Acme" },
  variant_attributes: { Color: "Red", Size: "L" },
  attribute_labels: { Color: "Colour", Size: "Size" },
  catalog_snapshot_source: "server",
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

describe("createOptimisticPoLineCatalogContextFromPicker", () => {
  it("includes picker catalog fields for immediate layout rendering", () => {
    const context = createOptimisticPoLineCatalogContextFromPicker({
      image_url: "https://cdn.example/item.jpg",
      base_unit_of_measure: "EA",
      description: "Widget",
      hsn_sac_code: "8471",
      variant_attributes: { Color: "Red" },
      custom_fields: { brand: "Acme" },
    });

    expect(context.catalog_snapshot_source).toBe("optimistic");
    expect(context.variant_attributes.Color).toBe("Red");
    expect(context.custom_fields.brand).toBe("Acme");
    expect(
      resolveCatalogLineFieldDisplay(
        createPoCatalogFieldPref("variant_attribute", "Color"),
        context
      )
    ).toBe("Red");
  });

  it("parses default purchase UOM from picker custom fields", () => {
    const context = createOptimisticPoLineCatalogContextFromPicker({
      base_unit_of_measure: "PCS",
      custom_fields: { [COMMERCE_DEFAULT_PURCHASE_UOM_KEY]: "BOX" },
    });

    expect(context.default_purchase_uom).toBe("BOX");
  });
});

describe("needsPoLineCatalogHydration", () => {
  it("requires hydration when context is missing", () => {
    expect(needsPoLineCatalogHydration(undefined)).toBe(true);
    expect(needsPoLineCatalogHydration(null)).toBe(true);
  });

  it("requires hydration for optimistic snapshots", () => {
    expect(
      needsPoLineCatalogHydration({
        ...emptyPoLineCatalogContext("https://cdn.example/item.jpg"),
        catalog_snapshot_source: "optimistic",
      })
    ).toBe(true);
  });

  it("skips hydration after server catalog fetch", () => {
    expect(needsPoLineCatalogHydration(sampleContext)).toBe(false);
  });
});

describe("mergePoLineCatalogContext", () => {
  it("keeps optimistic image when server context is missing", () => {
    const merged = mergePoLineCatalogContext(null, null, "https://cdn.example/item.jpg");
    expect(merged?.image_url).toBe("https://cdn.example/item.jpg");
  });

  it("keeps optimistic base unit when server returns null", () => {
    const merged = mergePoLineCatalogContext(
      {
        ...emptyPoLineCatalogContext("https://cdn.example/client.jpg"),
        base_unit_of_measure: "EA",
      },
      {
        ...emptyPoLineCatalogContext(),
        description: "Test",
      },
      "https://cdn.example/client.jpg"
    );

    expect(merged?.base_unit_of_measure).toBe("EA");
    expect(merged?.description).toBe("Test");
  });

  it("does not wipe server catalog fields when optimistic snapshot arrives late", () => {
    const merged = mergePoLineCatalogContext(
      {
        ...sampleContext,
        image_url: null,
      },
      {
        ...emptyPoLineCatalogContext("https://cdn.example/client.jpg"),
        catalog_snapshot_source: "optimistic",
      }
    );

    expect(merged?.catalog_snapshot_source).toBe("server");
    expect(merged?.custom_fields.brand).toBe("Acme");
    expect(merged?.variant_attributes.Color).toBe("Red");
    expect(merged?.image_url).toBe("https://cdn.example/client.jpg");
  });
});
