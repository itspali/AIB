import { describe, expect, it } from "vitest";
import {
  buildProductSkuImportPreview,
  buildSkuImportPreviewRows,
  detectDuplicateSkusInFile,
  skuImportTemplateCsv,
  validateSkuImportRow,
} from "@/lib/products/list-sku-import";

describe("buildProductSkuImportPreview", () => {
  it("maps fixed columns and treats unknown headers as attribute columns", () => {
    const preview = buildProductSkuImportPreview({
      headers: ["Name", "Product code", "SKU", "Material"],
      rows: [["Widget", "W-1", "W-1-RED", "Cotton"]],
    });

    expect(preview.mappedColumnIds).toEqual(["name", "product_code", "default_sku"]);
    expect(preview.attributeHeaders).toEqual(["Material"]);
    expect(preview.rows[0]).toMatchObject({
      rowNumber: 2,
      productCode: "W-1",
      sku: "W-1-RED",
      attributeValues: { material: "Cotton" },
    });
  });
});

describe("validateSkuImportRow", () => {
  it("requires SKU", () => {
    expect(
      validateSkuImportRow({
        rowNumber: 2,
        values: { name: "Widget" },
        attributeValues: {},
        productCode: "W-1",
        sku: "",
      })
    ).toBe("SKU is required.");
  });
});

describe("detectDuplicateSkusInFile", () => {
  it("returns duplicate SKU values", () => {
    const rows = buildSkuImportPreviewRows({
      headers: ["SKU"],
      rows: [["A-1"], ["A-1"], ["B-1"]],
    });
    expect(detectDuplicateSkusInFile(rows)).toEqual(["A-1"]);
  });
});

describe("skuImportTemplateCsv", () => {
  it("matches export template headers", () => {
    expect(skuImportTemplateCsv()).toMatch(/^Name,Product code,SKU,/);
  });

  it("round-trips through SKU import preview parsing", () => {
    const headers = skuImportTemplateCsv()
      .trim()
      .split(",")
      .map((header) => header.trim());
    const preview = buildProductSkuImportPreview({
      headers,
      rows: [["Widget", "W-1", "W-1-RED", "", "Hardware", "FINISHED_GOOD", "PCS", "10", "8", "Steel", "Red"]],
    });
    expect(preview.mappedColumnIds).toContain("name");
    expect(preview.mappedColumnIds).toContain("product_code");
    expect(preview.mappedColumnIds).toContain("default_sku");
    expect(preview.attributeHeaders).toEqual(["Material", "Color"]);
  });
});
