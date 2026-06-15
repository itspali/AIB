import { describe, expect, it } from "vitest";
import type { PoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import { emptyPoLineCatalogContext } from "@/lib/documents/catalog-line-values";
import { mapSalesCommerceLineToRpcPayload } from "@/lib/sales/shared/sales-commerce-line-rpc";
import type { SalesCommerceLineBase } from "@/lib/sales/shared/sales-line-entry";
import {
  buildSalesLineUomOptions,
  canEditSalesLineUom,
  formatSalesLineUomConversionHint,
  formatSalesPeekLineUomConversionHint,
  resolveDefaultSalesLineUomCode,
  resolveSalesDraftLineUomCode,
  resolveSalesDraftLineUomCodeForSave,
  resolveSalesLineUomAfterCatalogUpdate,
  resolveSalesLineUomConversionFactor,
  buildSalesDraftLineUomChangePatch,
  scaleSalesCatalogBaseUnitPriceToLineUom,
} from "@/lib/sales/shared/sales-line-uom-options";

function draftLine(
  partial: Partial<SalesCommerceLineBase> & Pick<SalesCommerceLineBase, "catalog_context">
): SalesCommerceLineBase {
  return {
    key: "line-1",
    sku: "SKU-1",
    variant_id: "variant-1",
    item_id: "item-1",
    item_name: "Widget",
    variant_sku: "SKU-1",
    unit_price_selling: "10",
    discount_percentage: "0",
    discount_amount: "0",
    skuError: null,
    ...partial,
  };
}

function catalogContext(
  partial: Partial<PoLineCatalogContext> &
    Pick<PoLineCatalogContext, "base_unit_of_measure">
): PoLineCatalogContext {
  return {
    ...emptyPoLineCatalogContext(),
    ...partial,
    mrp: partial.mrp ?? null,
    purchase_price: partial.purchase_price ?? null,
  };
}

describe("buildSalesLineUomOptions", () => {
  it("includes base and alternate UOMs sorted with base first", () => {
    const options = buildSalesLineUomOptions({
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

  it("prefers default selling UOM when listed in alternates", () => {
    expect(
      resolveDefaultSalesLineUomCode({
        base_unit_of_measure: "PCS",
        default_selling_uom: "BOX",
        alternate_uoms: [{ uom_code: "BOX", conversion_factor: 12 }],
      })
    ).toBe("BOX");
  });

  it("ignores default selling UOM when it is not registered in item_uoms", () => {
    expect(
      resolveDefaultSalesLineUomCode({
        base_unit_of_measure: "PCS",
        default_selling_uom: "KG",
        alternate_uoms: [],
      })
    ).toBe("PCS");
  });
});

describe("draft line UOM resolution", () => {
  it("uses explicit line uom when valid", () => {
    const line = draftLine({
      uom_code: "BOX",
      catalog_context: catalogContext({
        base_unit_of_measure: "PCS",
        alternate_uoms: [{ uom_code: "BOX", conversion_factor: 12 }],
      }),
    });
    expect(resolveSalesDraftLineUomCode(line)).toBe("BOX");
    expect(resolveSalesLineUomConversionFactor(line)).toBe(12);
    expect(canEditSalesLineUom(line)).toBe(true);
  });

  it("falls back to default selling UOM when line uom unset", () => {
    const line = draftLine({
      catalog_context: catalogContext({
        base_unit_of_measure: "PCS",
        default_selling_uom: "BOX",
        alternate_uoms: [{ uom_code: "BOX", conversion_factor: 12 }],
      }),
    });
    expect(resolveSalesDraftLineUomCode(line)).toBe("BOX");
    expect(canEditSalesLineUom(line)).toBe(true);
  });

  it("omits unregistered alternates from save payload", () => {
    const line = draftLine({
      uom_code: "KG",
      catalog_context: catalogContext({
        base_unit_of_measure: "PCS",
        default_selling_uom: "KG",
      }),
    });
    expect(resolveSalesDraftLineUomCode(line)).toBe("PCS");
    expect(resolveSalesDraftLineUomCodeForSave(line)).toBeUndefined();
  });

  it("includes registered alternates in save payload", () => {
    const line = draftLine({
      uom_code: "BOX",
      catalog_context: catalogContext({
        base_unit_of_measure: "PCS",
        default_selling_uom: "BOX",
        alternate_uoms: [{ uom_code: "BOX", conversion_factor: 12 }],
      }),
    });
    expect(resolveSalesDraftLineUomCodeForSave(line)).toBe("BOX");
  });
});

describe("resolveSalesLineUomAfterCatalogUpdate", () => {
  const boxSellingContext = catalogContext({
    base_unit_of_measure: "PCS",
    default_selling_uom: "BOX",
    alternate_uoms: [{ uom_code: "BOX", conversion_factor: 2 }],
  });

  it("upgrades implicit base unit to default selling UOM after catalog hydration", () => {
    expect(resolveSalesLineUomAfterCatalogUpdate("PCS", boxSellingContext)).toBe("BOX");
  });

  it("keeps default selling UOM when line already matches", () => {
    expect(resolveSalesLineUomAfterCatalogUpdate("BOX", boxSellingContext)).toBe("BOX");
  });

  it("keeps explicit non-base alternate when user chose a different UOM", () => {
    const context = catalogContext({
      base_unit_of_measure: "PCS",
      default_selling_uom: "BOX",
      alternate_uoms: [
        { uom_code: "BOX", conversion_factor: 2 },
        { uom_code: "CASE", conversion_factor: 24 },
      ],
    });
    expect(resolveSalesLineUomAfterCatalogUpdate("CASE", context)).toBe("CASE");
  });
});

describe("buildSalesDraftLineUomChangePatch", () => {
  const boxContext = catalogContext({
    base_unit_of_measure: "PCS",
    alternate_uoms: [{ uom_code: "BOX", conversion_factor: 2 }],
  });

  it("rescales selling unit price when switching PCS to BOX", () => {
    const line = draftLine({
      uom_code: "PCS",
      unit_price_selling: "10",
      catalog_context: boxContext,
    });
    expect(buildSalesDraftLineUomChangePatch(line, "BOX")).toEqual({
      uom_code: "BOX",
      unit_price_selling: "20.00",
    });
  });
});

describe("scaleSalesCatalogBaseUnitPriceToLineUom", () => {
  it("scales catalog selling rate to default line UOM", () => {
    const line = draftLine({
      uom_code: "BOX",
      catalog_context: catalogContext({
        base_unit_of_measure: "PCS",
        default_selling_uom: "BOX",
        alternate_uoms: [{ uom_code: "BOX", conversion_factor: 2 }],
      }),
    });
    expect(scaleSalesCatalogBaseUnitPriceToLineUom("10", line)).toBe("20.00");
  });
});

describe("formatSalesLineUomConversionHint", () => {
  const boxContext = catalogContext({
    base_unit_of_measure: "PCS",
    alternate_uoms: [{ uom_code: "BOX", conversion_factor: 2 }],
  });

  it("shows base equivalent when qty is entered", () => {
    const line = draftLine({
      uom_code: "BOX",
      catalog_context: boxContext,
    });
    expect(formatSalesLineUomConversionHint(line, "3")).toBe("(6 PCS)");
  });

  it("shows static ratio when qty is empty or zero", () => {
    const line = draftLine({
      uom_code: "BOX",
      catalog_context: boxContext,
    });
    expect(formatSalesLineUomConversionHint(line, "0")).toBe("1 BOX = 2 PCS");
  });

  it("returns null for base unit lines", () => {
    const line = draftLine({
      uom_code: "PCS",
      catalog_context: boxContext,
    });
    expect(formatSalesLineUomConversionHint(line, "1")).toBeNull();
  });
});

describe("formatSalesPeekLineUomConversionHint", () => {
  it("formats saved line conversion from persisted factor", () => {
    expect(
      formatSalesPeekLineUomConversionHint({
        uom_code: "BOX",
        base_unit_of_measure: "PCS",
        uom_conversion_factor: "12",
        quantity: "2",
      })
    ).toBe("(24 PCS)");
  });
});

describe("mapSalesCommerceLineToRpcPayload", () => {
  it("maps quantity and unit_price and includes alternate uom_code", () => {
    const line = draftLine({
      uom_code: "BOX",
      catalog_context: catalogContext({
        base_unit_of_measure: "PCS",
        alternate_uoms: [{ uom_code: "BOX", conversion_factor: 12 }],
      }),
    });
    expect(mapSalesCommerceLineToRpcPayload(line, 3)).toEqual({
      variant_id: "variant-1",
      quantity: 3,
      unit_price: 10,
      discount_percentage: 0,
      discount_amount: 0,
      uom_code: "BOX",
    });
  });

  it("omits uom_code when line uses base unit", () => {
    const line = draftLine({
      uom_code: "PCS",
      catalog_context: catalogContext({
        base_unit_of_measure: "PCS",
        alternate_uoms: [{ uom_code: "BOX", conversion_factor: 12 }],
      }),
    });
    expect(mapSalesCommerceLineToRpcPayload(line, 1)).toEqual({
      variant_id: "variant-1",
      quantity: 1,
      unit_price: 10,
      discount_percentage: 0,
      discount_amount: 0,
    });
  });

  it("keeps alternate uom_code from save payload without catalog snapshot", () => {
    expect(
      mapSalesCommerceLineToRpcPayload(
        {
          variant_id: "variant-1",
          unit_price_selling: "10",
          discount_percentage: "0",
          discount_amount: "0",
          uom_code: "BOX",
        },
        1
      )
    ).toEqual({
      variant_id: "variant-1",
      quantity: 1,
      unit_price: 10,
      discount_percentage: 0,
      discount_amount: 0,
      uom_code: "BOX",
    });
  });
});
