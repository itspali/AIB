import { describe, expect, it } from "vitest";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import {
  buildSkuGrainExportMatrix,
  collectVariantAttributeKeys,
  filterSkuGrainExportRows,
  flattenVariantAttributes,
  resolveSkuGrainDefaultColumnIds,
} from "@/lib/products/list-sku-export";
import type { ProductListRow } from "@/lib/products/types";

const permissions: ProductFieldPermissions = {
  role: "OWNER",
  allowedFields: ["name", "product_code", "default_sku", "selling_price"],
};

function baseRow(overrides: Partial<ProductListRow> = {}): ProductListRow {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    name: "Sample item",
    default_sku: "SKU-1",
    classification: "FINISHED_GOOD",
    base_unit_of_measure: "PCS",
    category_id: null,
    category_name: null,
    description: null,
    hsn_sac_code: null,
    has_variants: false,
    default_tax_category: "TAXABLE",
    is_active: true,
    is_purchasable: true,
    is_salable: true,
    is_returnable: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

describe("filterSkuGrainExportRows", () => {
  it("drops multi-SKU parent rows without variant_id", () => {
    const parent = baseRow({
      variant_strategy: "MULTI_SKU",
      has_variants: true,
      style_code: "STYLE-1",
    });
    const child = baseRow({
      variant_strategy: "MULTI_SKU",
      has_variants: true,
      variant_id: "22222222-2222-2222-2222-222222222222",
      default_sku: "STYLE-1-RED",
      variant_attributes: { color: "Red" },
    });

    expect(filterSkuGrainExportRows([parent, child])).toEqual([child]);
  });

  it("keeps single-SKU rows and variant child rows", () => {
    const single = baseRow();
    const child = baseRow({
      variant_id: "22222222-2222-2222-2222-222222222222",
      default_sku: "SKU-2",
    });
    expect(filterSkuGrainExportRows([single, child])).toEqual([single, child]);
  });
});

describe("flattenVariantAttributes", () => {
  it("stringifies scalar and array attribute values", () => {
    const row = baseRow({
      variant_attributes: { color: "Red", tags: ["A", "B"] },
    });
    expect(flattenVariantAttributes(row, ["color", "tags", "missing"])).toEqual({
      color: "Red",
      tags: "A, B",
      missing: "",
    });
  });
});

describe("buildSkuGrainExportMatrix", () => {
  it("appends dynamic axis columns from variant attributes", () => {
    const rows = [
      baseRow({
        variant_id: "22222222-2222-2222-2222-222222222222",
        default_sku: "SKU-RED",
        selling_price: "10",
        variant_attributes: { color: "Red" },
      }),
    ];

    const matrix = buildSkuGrainExportMatrix(
      rows,
      ["name", "default_sku", "selling_price"],
      permissions
    );

    expect(matrix.headers).toEqual(["Name", "SKU", "Selling price", "color"]);
    expect(matrix.rows[0]).toEqual(["Sample item", "SKU-RED", "10", "Red"]);
    expect(collectVariantAttributeKeys(rows)).toEqual(["color"]);
  });
});

describe("resolveSkuGrainDefaultColumnIds", () => {
  it("prefers sku-oriented columns when allowed", () => {
    expect(
      resolveSkuGrainDefaultColumnIds(["name", "product_code", "default_sku", "classification"])
    ).toEqual(["name", "product_code", "default_sku", "classification"]);
  });
});
