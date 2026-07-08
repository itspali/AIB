import type { CategoryRow } from "@/lib/categories/types";
import {
  PRODUCT_LIST_COLUMNS,
  type ProductListColumnId,
} from "@/lib/products/list-columns";
import { SKU_IMPORT_TEMPLATE_HEADERS } from "@/lib/products/list-sku-export";
import type { ProductMasterFormValues } from "@/lib/products/types";
import type { ParsedSpreadsheet, ProductListImportRow } from "@/lib/products/list-import";
import { buildProductMasterInputFromImportRow } from "@/lib/products/list-import";

export type ProductSkuImportRow = ProductListImportRow & {
  attributeValues: Record<string, string>;
  productCode: string;
  sku: string;
};

export type ProductSkuImportPreview = {
  headers: string[];
  rows: ProductSkuImportRow[];
  mappedColumnIds: ProductListColumnId[];
  attributeHeaders: string[];
};

const LABEL_TO_COLUMN_ID = new Map(
  PRODUCT_LIST_COLUMNS.map((column) => [column.label.trim().toLowerCase(), column.id])
);

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function parseRowValues(
  headers: string[],
  cells: string[]
): Pick<ProductSkuImportRow, "values" | "attributeValues" | "productCode" | "sku"> {
  const values: Partial<Record<ProductListColumnId, string>> = {};
  const attributeValues: Record<string, string> = {};

  headers.forEach((header, columnIndex) => {
    const normalized = normalizeHeader(header);
    const columnId = LABEL_TO_COLUMN_ID.get(normalized);
    const cell = cells[columnIndex]?.trim() ?? "";
    if (columnId) {
      values[columnId] = cell;
      return;
    }
    if (!normalized || !cell) return;
    attributeValues[normalized.replace(/\s+/g, "_")] = cell;
  });

  return {
    values,
    attributeValues,
    productCode: values.product_code?.trim() ?? "",
    sku: values.default_sku?.trim() ?? "",
  };
}

export function buildProductSkuImportPreview(
  sheet: ParsedSpreadsheet,
  maxPreviewRows = 8
): ProductSkuImportPreview {
  const mappedColumnIds = sheet.headers
    .map((header) => LABEL_TO_COLUMN_ID.get(normalizeHeader(header)) ?? null)
    .filter((id): id is ProductListColumnId => id != null);
  const attributeHeaders = sheet.headers.filter(
    (header) => !LABEL_TO_COLUMN_ID.has(normalizeHeader(header))
  );

  const rows = sheet.rows.slice(0, maxPreviewRows).map((cells, index) => ({
    rowNumber: index + 2,
    ...parseRowValues(sheet.headers, cells),
  }));

  return {
    headers: sheet.headers,
    rows,
    mappedColumnIds,
    attributeHeaders,
  };
}

export function buildSkuImportPreviewRows(sheet: ParsedSpreadsheet): ProductSkuImportRow[] {
  return sheet.rows.map((cells, index) => ({
    rowNumber: index + 2,
    ...parseRowValues(sheet.headers, cells),
  }));
}

export function validateSkuImportRow(row: ProductSkuImportRow): string | null {
  if (!row.sku.trim()) return "SKU is required.";
  return null;
}

export function detectDuplicateSkusInFile(rows: ProductSkuImportRow[]): string[] {
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  for (const row of rows) {
    const sku = row.sku.trim().toLowerCase();
    if (!sku) continue;
    const count = (seen.get(sku) ?? 0) + 1;
    seen.set(sku, count);
    if (count === 2) duplicates.push(row.sku.trim());
  }
  return duplicates;
}

export function buildProductMasterInputFromSkuImportRow(
  row: ProductSkuImportRow,
  categories: CategoryRow[],
  options?: { itemId?: string | null; productCode?: string }
): ProductMasterFormValues | null {
  const base = buildProductMasterInputFromImportRow(row, categories);
  if (!base) return null;

  const productCode = options?.productCode?.trim() || row.productCode.trim() || row.sku.trim();
  return {
    ...base,
    item_id: options?.itemId ?? null,
    sku: productCode,
    variant_attributes: {
      ...base.variant_attributes,
      ...row.attributeValues,
    },
  };
}

export function buildVariantInputFromSkuImportRow(
  row: ProductSkuImportRow,
  itemId: string,
  variantId?: string | null
) {
  return {
    variant_id: variantId ?? null,
    item_id: itemId,
    sku: row.sku.trim(),
    barcode: row.values.barcode?.trim() ?? "",
    dead_weight_kg: "0",
    volume: "",
    length_cm: "0",
    width_cm: "0",
    height_cm: "0",
    is_active: true,
    price: row.values.selling_price?.trim() ?? "",
    variant_attributes: row.attributeValues,
  };
}

export function skuImportTemplateCsv(): string {
  return `${SKU_IMPORT_TEMPLATE_HEADERS.join(",")}\r\n`;
}
