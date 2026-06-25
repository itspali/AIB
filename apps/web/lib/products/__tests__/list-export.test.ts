import { describe, expect, it } from "vitest";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import {
  buildProductListExportMatrix,
  productListExportMatrixToCsv,
  resolveProductListPdfLandscape,
  resolveProductListPdfOrientationLabel,
} from "@/lib/products/list-export";
import type { ProductListRow } from "@/lib/products/types";

const permissions: ProductFieldPermissions = {
  role: "OWNER",
  allowedFields: ["name", "default_sku", "classification"],
};

const sampleRow: ProductListRow = {
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
};

describe("product list export", () => {
  it("builds a matrix for selected columns", () => {
    const matrix = buildProductListExportMatrix(
      [sampleRow],
      ["name", "default_sku", "classification"],
      permissions
    );

    expect(matrix.headers).toEqual(["Name", "SKU", "Classification"]);
    expect(matrix.rows[0]).toEqual(["Sample item", "SKU-1", "Finished Good"]);
  });

  it("escapes csv values", () => {
    const matrix = buildProductListExportMatrix(
      [{ ...sampleRow, name: 'Item, "special"' }],
      ["name"],
      permissions
    );
    expect(productListExportMatrixToCsv(matrix)).toContain('"Item, ""special"""');
  });

  it("switches pdf orientation when column count is high", () => {
    expect(resolveProductListPdfLandscape(6)).toBe(false);
    expect(resolveProductListPdfLandscape(7)).toBe(true);
    expect(resolveProductListPdfOrientationLabel(6)).toBe("portrait");
    expect(resolveProductListPdfOrientationLabel(7)).toBe("landscape");
  });
});
