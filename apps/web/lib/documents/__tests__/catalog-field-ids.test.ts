import { describe, expect, it } from "vitest";
import {
  VARIANT_ATTRIBUTES_ALL_ID,
  buildCatalogFieldId,
  isCatalogFieldId,
  parseCatalogFieldId,
} from "@/lib/documents/catalog-field-ids";

describe("catalog-field-ids", () => {
  it("builds and parses catalog field ids", () => {
    expect(buildCatalogFieldId("item_column", "hsn_sac_code")).toBe("item_col:hsn_sac_code");
    expect(buildCatalogFieldId("item_custom_field", "brand")).toBe("item_cf:brand");
    expect(buildCatalogFieldId("variant_attribute", "Color")).toBe("variant_attr:Color");
    expect(buildCatalogFieldId("variant_attributes_all", "__all__")).toBe(VARIANT_ATTRIBUTES_ALL_ID);

    expect(parseCatalogFieldId("item_col:description")).toEqual({
      source: "item_column",
      key: "description",
    });
    expect(parseCatalogFieldId("item_cf:brand")).toEqual({
      source: "item_custom_field",
      key: "brand",
    });
    expect(parseCatalogFieldId(VARIANT_ATTRIBUTES_ALL_ID)).toEqual({
      source: "variant_attributes_all",
      key: "__all__",
    });
  });

  it("detects catalog field ids", () => {
    expect(isCatalogFieldId("item_col:hsn_sac_code")).toBe(true);
    expect(isCatalogFieldId("quantity_ordered")).toBe(false);
  });
});
