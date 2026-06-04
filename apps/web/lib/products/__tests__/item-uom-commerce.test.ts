import { describe, expect, it } from "vitest";
import {
  buildAlternateUomsPayload,
  buildCommerceCustomFieldDefaults,
  conversionFactorForAlternate,
  formatAlternateUomConversionPreview,
} from "@/lib/products/item-uom-commerce";
import type { ProductMasterInput } from "@/lib/products/schemas";

function baseValues(overrides: Partial<ProductMasterInput> = {}): ProductMasterInput {
  return {
    item_id: null,
    updated_at: null,
    classification: "FINISHED_GOOD",
    name: "Widget",
    description: "",
    sku: "W-1",
    barcode: "",
    base_unit_of_measure: "PCS",
    category_id: null,
    variant_strategy: "SINGLE_SKU",
    variant_axes: [],
    item_type: "PHYSICAL",
    track_inventory: true,
    reorder_point: "",
    status: "ACTIVE",
    needs_review: false,
    costing_method: "WEIGHTED_AVG",
    standard_cost: "",
    tracking_mode: "NONE",
    is_bundle: false,
    price_is_tax_inclusive: false,
    is_purchasable: true,
    is_salable: true,
    is_active: true,
    hsn_sac_code: "",
    has_variants: false,
    default_tax_category: "TAXABLE",
    tax_code_id: null,
    is_returnable: true,
    dead_weight_kg: "0",
    volume: "",
    length_cm: "0",
    width_cm: "0",
    height_cm: "0",
    variant_is_active: true,
    variant_attributes: {},
    selling_price: "",
    mrp: "",
    selling_uom: "PCS",
    purchase_uom: "PCS",
    purchase_uom_conversion: "1",
    purchase_price: "",
    supplier_id: null,
    show_advanced: false,
    sku_mask: "",
    custom_fields: [],
    alternate_uoms: [{ uom_code: "BOX", conversion_factor: "12" }],
    tag_ids: [],
    storefront_visibility: [],
    ...overrides,
  };
}

describe("item-uom-commerce", () => {
  it("reads conversion from catalog alternates", () => {
    expect(conversionFactorForAlternate([{ uom_code: "BOX", conversion_factor: "12" }], "BOX")).toBe(
      "12"
    );
  });

  it("formats alternate unit conversion preview with managed names", () => {
    expect(
      formatAlternateUomConversionPreview("BOX", "12", "PCS", [
        { code: "BOX", name: "Box" },
        { code: "PCS", name: "Pieces" },
      ])
    ).toBe("1 box = 12 pieces");
  });

  it("formats preview using codes when names are unavailable", () => {
    expect(formatAlternateUomConversionPreview("PKT", "6", "LTRS", [])).toBe("1 pkt = 6 ltrs");
  });

  it("returns null for invalid conversion factor", () => {
    expect(formatAlternateUomConversionPreview("BOX", "", "PCS", [])).toBeNull();
    expect(formatAlternateUomConversionPreview("BOX", "0", "PCS", [])).toBeNull();
  });

  it("prefers catalog factor when building purchase row", () => {
    const rows = buildAlternateUomsPayload(
      baseValues({
        purchase_uom: "BOX",
        purchase_uom_conversion: "99",
      })
    );
    expect(rows.find((row) => row.uom_code === "BOX")?.conversion_factor).toBe(12);
  });

  it("stores default commerce units in custom field payload", () => {
    expect(
      buildCommerceCustomFieldDefaults(
        baseValues({ selling_uom: "BOX", purchase_uom: "BOX" })
      )
    ).toEqual({
      _default_purchase_uom: "BOX",
      _default_selling_uom: "BOX",
    });
  });
});
