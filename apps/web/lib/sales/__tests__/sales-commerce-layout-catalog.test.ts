import { describe, expect, it } from "vitest";
import { VARIANT_ATTRIBUTES_ALL_ID } from "@/lib/documents/catalog-field-ids";
import {
  addSalesCatalogField,
  createSalesCatalogFieldPref,
  DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  getSalesItemDetailLineFields,
  getVisibleSalesCatalogLineFields,
  removeSalesCatalogField,
} from "@/lib/sales/shared/sales-commerce-layout";

describe("sales commerce layout catalog fields", () => {
  it("includes variant attributes in default catalog field order", () => {
    expect(DEFAULT_SALES_ORDER_SCREEN_LAYOUT.catalogLineFieldOrder).toContain(
      VARIANT_ATTRIBUTES_ALL_ID
    );
    expect(getVisibleSalesCatalogLineFields(DEFAULT_SALES_ORDER_SCREEN_LAYOUT).map((column) => column.id)).toEqual([
      VARIANT_ATTRIBUTES_ALL_ID,
    ]);
  });

  it("merges visible catalog fields into item detail fields", () => {
    expect(getSalesItemDetailLineFields(DEFAULT_SALES_ORDER_SCREEN_LAYOUT).map((column) => column.id)).toEqual([
      VARIANT_ATTRIBUTES_ALL_ID,
    ]);
  });

  it("adds and removes custom catalog fields", () => {
    const customPref = createSalesCatalogFieldPref("variant_attribute", "Color", "Color");
    const withCustom = addSalesCatalogField(DEFAULT_SALES_ORDER_SCREEN_LAYOUT, customPref);
    expect(withCustom.catalogLineFieldOrder).toContain(customPref.id);

    const removed = removeSalesCatalogField(withCustom, customPref.id);
    expect(removed.catalogLineFieldOrder).not.toContain(customPref.id);
    expect(removed.columns.some((column) => column.id === customPref.id)).toBe(false);
  });
});
