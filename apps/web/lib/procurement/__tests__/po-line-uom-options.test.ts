import { describe, expect, it } from "vitest";
import {
  buildPoLineUomOptions,
  canEditPoLineUom,
  resolveDefaultPoLineUomCode,
  resolvePoDraftLineUomCode,
  resolvePoDraftLineUomCodeForSave,
  formatPoLineUomConversionHint,
  formatPoPeekLineUomConversionHint,
  resolvePoLineUomAfterCatalogUpdate,
  resolvePoLineUomConversionFactor,
  resolvePoPeekLineUomCode,
} from "@/lib/procurement/purchase-orders/po-line-uom-options";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";
import type { PurchaseOrderLineRow } from "@/lib/procurement/purchase-orders/types";

function draftLine(
  partial: Partial<PoDraftLine> & Pick<PoDraftLine, "catalog_context">
): PoDraftLine {
  return {
    key: "line-1",
    sku: "SKU-1",
    variant_id: "variant-1",
    item_id: "item-1",
    item_name: "Widget",
    variant_sku: "SKU-1",
    quantity_ordered: "2",
    unit_price_contractual: "10",
    discount_percentage: "0",
    discount_amount: "0",
    skuError: null,
    ...partial,
  };
}

describe("buildPoLineUomOptions", () => {
  it("includes base and alternate UOMs sorted with base first", () => {
    const options = buildPoLineUomOptions({
      base_unit_of_measure: "PCS",
      alternate_uoms: [
        { uom_code: "BOX", conversion_factor: 12 },
        { uom_code: "CASE", conversion_factor: 48 },
      ],
    });
    expect(options.map((row) => row.uom_code)).toEqual(["PCS", "BOX", "CASE"]);
    expect(options[0]?.conversion_factor).toBe(1);
    expect(options[1]?.conversion_factor).toBe(12);
  });

  it("prefers default purchase UOM when listed in alternates", () => {
    expect(
      resolveDefaultPoLineUomCode({
        base_unit_of_measure: "PCS",
        default_purchase_uom: "BOX",
        alternate_uoms: [{ uom_code: "BOX", conversion_factor: 12 }],
      })
    ).toBe("BOX");
  });

  it("ignores default purchase UOM when it is not registered in item_uoms", () => {
    const options = buildPoLineUomOptions({
      base_unit_of_measure: "PCS",
      default_purchase_uom: "KG",
      alternate_uoms: [],
    });
    expect(options.map((row) => row.uom_code)).toEqual(["PCS"]);
    expect(
      resolveDefaultPoLineUomCode({
        base_unit_of_measure: "PCS",
        default_purchase_uom: "KG",
        alternate_uoms: [],
      })
    ).toBe("PCS");
  });
});

describe("draft line UOM resolution", () => {
  it("uses explicit line uom when valid", () => {
    const line = draftLine({
      uom_code: "BOX",
      catalog_context: {
        description: null,
        hsn_sac_code: null,
        base_unit_of_measure: "PCS",
        image_url: null,
        tax_code_id: null,
        tax_rate: 0,
        tax_is_variable: false,
        default_purchase_uom: null,
        alternate_uoms: [{ uom_code: "BOX", conversion_factor: 12 }],
        custom_fields: {},
        variant_attributes: {},
        attribute_labels: {},
      },
    });
    expect(resolvePoDraftLineUomCode(line)).toBe("BOX");
    expect(resolvePoLineUomConversionFactor(line)).toBe(12);
    expect(canEditPoLineUom(line)).toBe(true);
  });

  it("falls back to default purchase UOM when line uom unset", () => {
    const line = draftLine({
      catalog_context: {
        description: null,
        hsn_sac_code: null,
        base_unit_of_measure: "PCS",
        image_url: null,
        tax_code_id: null,
        tax_rate: 0,
        tax_is_variable: false,
        default_purchase_uom: "BOX",
        alternate_uoms: [{ uom_code: "BOX", conversion_factor: 12 }],
        custom_fields: {},
        variant_attributes: {},
        attribute_labels: {},
      },
    });
    expect(resolvePoDraftLineUomCode(line)).toBe("BOX");
    expect(canEditPoLineUom(line)).toBe(true);
  });

  it("omits unregistered alternates from save payload", () => {
    const line = draftLine({
      uom_code: "KG",
      catalog_context: {
        description: null,
        hsn_sac_code: null,
        base_unit_of_measure: "PCS",
        image_url: null,
        tax_code_id: null,
        tax_rate: 0,
        tax_is_variable: false,
        default_purchase_uom: "KG",
        alternate_uoms: [],
        custom_fields: {},
        variant_attributes: {},
        attribute_labels: {},
      },
    });
    expect(resolvePoDraftLineUomCode(line)).toBe("PCS");
    expect(resolvePoDraftLineUomCodeForSave(line)).toBeUndefined();
  });

  it("includes registered alternates in save payload", () => {
    const line = draftLine({
      uom_code: "BOX",
      catalog_context: {
        description: null,
        hsn_sac_code: null,
        base_unit_of_measure: "PCS",
        image_url: null,
        tax_code_id: null,
        tax_rate: 0,
        tax_is_variable: false,
        default_purchase_uom: "BOX",
        alternate_uoms: [{ uom_code: "BOX", conversion_factor: 12 }],
        custom_fields: {},
        variant_attributes: {},
        attribute_labels: {},
      },
    });
    expect(resolvePoDraftLineUomCodeForSave(line)).toBe("BOX");
  });
});

function catalogContext(
  partial: Partial<PoLineCatalogContext> &
    Pick<PoLineCatalogContext, "base_unit_of_measure">
): PoLineCatalogContext {
  return {
    description: null,
    hsn_sac_code: null,
    image_url: null,
    tax_code_id: null,
    tax_rate: 0,
    tax_is_variable: false,
    default_purchase_uom: null,
    alternate_uoms: [],
    custom_fields: {},
    variant_attributes: {},
    attribute_labels: {},
    ...partial,
  };
}

describe("resolvePoLineUomAfterCatalogUpdate", () => {
  const boxPurchaseContext = catalogContext({
    base_unit_of_measure: "PCS",
    default_purchase_uom: "BOX",
    alternate_uoms: [{ uom_code: "BOX", conversion_factor: 2 }],
  });

  it("upgrades implicit base unit to default purchase UOM after catalog hydration", () => {
    expect(resolvePoLineUomAfterCatalogUpdate("PCS", boxPurchaseContext)).toBe("BOX");
  });

  it("keeps default purchase UOM when line already matches", () => {
    expect(resolvePoLineUomAfterCatalogUpdate("BOX", boxPurchaseContext)).toBe("BOX");
  });

  it("keeps explicit non-base alternate when user chose a different UOM", () => {
    const context = catalogContext({
      base_unit_of_measure: "PCS",
      default_purchase_uom: "BOX",
      alternate_uoms: [
        { uom_code: "BOX", conversion_factor: 2 },
        { uom_code: "CASE", conversion_factor: 24 },
      ],
    });
    expect(resolvePoLineUomAfterCatalogUpdate("CASE", context)).toBe("CASE");
  });
});

describe("formatPoLineUomConversionHint", () => {
  const boxContext = catalogContext({
    base_unit_of_measure: "PCS",
    alternate_uoms: [{ uom_code: "BOX", conversion_factor: 2 }],
  });

  it("shows base equivalent when qty is entered", () => {
    const line = draftLine({
      uom_code: "BOX",
      quantity_ordered: "3",
      catalog_context: boxContext,
    });
    expect(formatPoLineUomConversionHint(line)).toBe("(6 PCS)");
  });

  it("shows static ratio when qty is empty or zero", () => {
    const line = draftLine({
      uom_code: "BOX",
      quantity_ordered: "0",
      catalog_context: boxContext,
    });
    expect(formatPoLineUomConversionHint(line)).toBe("1 BOX = 2 PCS");
  });

  it("returns null for base unit lines", () => {
    const line = draftLine({
      uom_code: "PCS",
      catalog_context: boxContext,
    });
    expect(formatPoLineUomConversionHint(line)).toBeNull();
  });
});

describe("formatPoPeekLineUomConversionHint", () => {
  it("formats saved line conversion from persisted factor", () => {
    const line: PurchaseOrderLineRow = {
      id: "line-1",
      item_id: "item-1",
      item_name: "Widget",
      variant_id: "variant-1",
      variant_sku: "SKU-1",
      quantity_ordered: "2",
      quantity_received: "0",
      unit_price_contractual: "10",
      discount_percentage: "0",
      discount_amount: "0",
      tax_rate_percentage: "0",
      line_tax_amount: "0",
      tax_components: [],
      line_total_gross: "20",
      open_quantity: "2",
      uom_code: "BOX",
      uom_conversion_factor: "12",
      base_unit_of_measure: "PCS",
    };
    expect(formatPoPeekLineUomConversionHint(line)).toBe("(24 PCS)");
  });
});

describe("resolvePoPeekLineUomCode", () => {
  it("prefers saved line uom over item base", () => {
    const line: PurchaseOrderLineRow = {
      id: "line-1",
      item_id: "item-1",
      item_name: "Widget",
      variant_id: "variant-1",
      variant_sku: "SKU-1",
      quantity_ordered: "2",
      quantity_received: "0",
      unit_price_contractual: "10",
      discount_percentage: "0",
      discount_amount: "0",
      tax_rate_percentage: "0",
      line_tax_amount: "0",
      tax_components: [],
      line_total_gross: "20",
      open_quantity: "2",
      uom_code: "BOX",
      uom_conversion_factor: "12",
      base_unit_of_measure: "PCS",
    };
    expect(resolvePoPeekLineUomCode(line)).toBe("BOX");
  });
});
