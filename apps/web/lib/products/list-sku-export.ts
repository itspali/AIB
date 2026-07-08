import {
  buildProductListExportMatrix,
  formatProductListExportCell,
  resolveProductListExportColumns,
  type ProductListExportMatrix,
} from "@/lib/products/list-export";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import type { ProductListRow } from "@/lib/products/types";

export type SkuGrainExportColumn = {
  id: ProductListColumnId | `attr:${string}`;
  label: string;
};

/** Rows suitable for one-row-per-SKU export (excludes multi-SKU parent/style rows). */
export function filterSkuGrainExportRows(rows: ProductListRow[]): ProductListRow[] {
  return rows.filter((row) => {
    const strategy = row.variant_strategy ?? "SINGLE_SKU";
    if ((strategy === "MULTI_SKU" || row.has_variants) && !row.variant_id) {
      return false;
    }
    return true;
  });
}

export function collectVariantAttributeKeys(rows: ProductListRow[]): string[] {
  const keys = new Set<string>();
  for (const row of rows) {
    const attributes = row.variant_attributes ?? {};
    for (const key of Object.keys(attributes)) {
      if (key.trim()) keys.add(key);
    }
  }
  return Array.from(keys).sort((a, b) => a.localeCompare(b));
}

export function flattenVariantAttributes(
  row: ProductListRow,
  axisKeys: string[]
): Record<string, string> {
  const attributes = row.variant_attributes ?? {};
  const output: Record<string, string> = {};
  for (const key of axisKeys) {
    const raw = attributes[key];
    if (raw === null || raw === undefined) {
      output[key] = "";
      continue;
    }
    output[key] = Array.isArray(raw) ? raw.map(String).join(", ") : String(raw);
  }
  return output;
}

export const SKU_IMPORT_TEMPLATE_HEADERS = [
  "Name",
  "Product code",
  "SKU",
  "GTIN",
  "Category",
  "Classification",
  "Base UOM",
  "Selling price",
  "Purchase price",
  "Material",
  "Color",
] as const;

export function buildSkuGrainExportMatrix(
  rows: ProductListRow[],
  columnIds: ProductListColumnId[],
  fieldPermissions: ProductFieldPermissions,
  options?: { includeAttributeColumns?: boolean }
): ProductListExportMatrix & { attributeKeys: string[] } {
  const skuRows = filterSkuGrainExportRows(rows);
  const attributeKeys =
    options?.includeAttributeColumns === false ? [] : collectVariantAttributeKeys(skuRows);
  const baseMatrix = buildProductListExportMatrix(skuRows, columnIds, fieldPermissions);
  const attributeHeaders = attributeKeys.map((key) => key.replace(/_/g, " "));
  const attributeRows = skuRows.map((row) => {
    const flat = flattenVariantAttributes(row, attributeKeys);
    return attributeKeys.map((key) => flat[key] ?? "");
  });

  return {
    headers: [...baseMatrix.headers, ...attributeHeaders],
    rows: baseMatrix.rows.map((cells, index) => [...cells, ...(attributeRows[index] ?? [])]),
    columnIds: baseMatrix.columnIds,
    attributeKeys,
  };
}

export function resolveSkuGrainDefaultColumnIds(
  columnIds: ProductListColumnId[]
): ProductListColumnId[] {
  const preferred: ProductListColumnId[] = [
    "name",
    "product_code",
    "default_sku",
    "barcode",
    "category_name",
    "classification",
    "base_unit_of_measure",
    "selling_price",
    "purchase_price",
    "stock_on_hand",
  ];
  const allowed = new Set(columnIds);
  const picked = preferred.filter((id) => allowed.has(id));
  return picked.length > 0 ? picked : columnIds;
}

export function skuGrainMatrixToTemplateCsv(matrix: ProductListExportMatrix): string {
  const header = matrix.headers.join(",");
  return `${header}\r\n`;
}

export function formatSkuGrainPreviewCell(row: ProductListRow, columnId: ProductListColumnId): string {
  return formatProductListExportCell(row, columnId);
}

export function resolveSkuGrainExportColumns(
  columnIds: ProductListColumnId[],
  fieldPermissions: ProductFieldPermissions
) {
  return resolveProductListExportColumns(columnIds, fieldPermissions);
}
