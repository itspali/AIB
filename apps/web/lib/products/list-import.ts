import {
  classificationLabel,
  isItemClassification,
  ITEM_CLASSIFICATIONS,
} from "@/lib/products/classification-labels";
import type { CategoryRow } from "@/lib/categories/types";
import {
  PRODUCT_LIST_COLUMNS,
  type ProductListColumnId,
} from "@/lib/products/list-columns";
import { TAX_CATEGORY_OPTIONS, taxCategoryLabel } from "@/lib/products/tax-options";
import type { ProductMasterFormValues } from "@/lib/products/types";
import { defaultProductFormValues } from "@/lib/products/types";

export type ParsedSpreadsheet = {
  headers: string[];
  rows: string[][];
};

export type ProductListImportRow = {
  rowNumber: number;
  values: Partial<Record<ProductListColumnId, string>>;
};

export type ProductListImportPreview = {
  headers: string[];
  rows: ProductListImportRow[];
  mappedColumnIds: ProductListColumnId[];
};

const LABEL_TO_COLUMN_ID = new Map(
  PRODUCT_LIST_COLUMNS.map((column) => [column.label.trim().toLowerCase(), column.id])
);

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase();
}

function parseYesNo(value: string | undefined, fallback: boolean): boolean {
  if (!value?.trim()) return fallback;
  const normalized = value.trim().toLowerCase();
  if (["yes", "y", "true", "1", "active"].includes(normalized)) return true;
  if (["no", "n", "false", "0", "inactive"].includes(normalized)) return false;
  return fallback;
}

function parseClassification(value: string | undefined): ProductMasterFormValues["classification"] {
  if (!value?.trim()) return defaultProductFormValues.classification;
  const trimmed = value.trim();
  if (isItemClassification(trimmed)) return trimmed;
  const byLabel = ITEM_CLASSIFICATIONS.find(
    (entry) => classificationLabel(entry).toLowerCase() === trimmed.toLowerCase()
  );
  return byLabel ?? defaultProductFormValues.classification;
}

function parseTaxCategory(value: string | undefined): ProductMasterFormValues["default_tax_category"] {
  if (!value?.trim()) return defaultProductFormValues.default_tax_category;
  const trimmed = value.trim();
  const direct = TAX_CATEGORY_OPTIONS.find((entry) => entry === trimmed);
  if (direct) return direct;
  const byLabel = TAX_CATEGORY_OPTIONS.find(
    (entry) => taxCategoryLabel(entry).toLowerCase() === trimmed.toLowerCase()
  );
  return byLabel ?? defaultProductFormValues.default_tax_category;
}

function resolveCategoryId(
  categoryName: string | undefined,
  categories: CategoryRow[]
): string | null {
  if (!categoryName?.trim()) return null;
  const needle = categoryName.trim().toLowerCase();
  const match = categories.find((row) => row.name.trim().toLowerCase() === needle);
  return match?.id ?? null;
}

export function mapSpreadsheetHeaders(headers: string[]): ProductListColumnId[] {
  return headers.map((header) => LABEL_TO_COLUMN_ID.get(normalizeHeader(header)) ?? null).filter(
    (id): id is ProductListColumnId => id != null
  );
}

export function buildProductListImportPreview(
  sheet: ParsedSpreadsheet,
  maxPreviewRows = 8
): ProductListImportPreview {
  const mappedColumnIds = mapSpreadsheetHeaders(sheet.headers);
  const rows = sheet.rows.slice(0, maxPreviewRows).map((cells, index) => {
    const values: Partial<Record<ProductListColumnId, string>> = {};
    sheet.headers.forEach((header, columnIndex) => {
      const columnId = LABEL_TO_COLUMN_ID.get(normalizeHeader(header));
      if (!columnId) return;
      values[columnId] = cells[columnIndex]?.trim() ?? "";
    });
    return { rowNumber: index + 2, values };
  });

  return {
    headers: sheet.headers,
    rows,
    mappedColumnIds,
  };
}

export function buildImportPreviewRows(sheet: ParsedSpreadsheet): ProductListImportRow[] {
  return sheet.rows.map((cells, index) => {
    const values: Partial<Record<ProductListColumnId, string>> = {};
    sheet.headers.forEach((header, columnIndex) => {
      const columnId = LABEL_TO_COLUMN_ID.get(normalizeHeader(header));
      if (!columnId) return;
      values[columnId] = cells[columnIndex]?.trim() ?? "";
    });
    return { rowNumber: index + 2, values };
  });
}

export function buildProductMasterInputFromImportRow(
  row: ProductListImportRow,
  categories: CategoryRow[]
): ProductMasterFormValues | null {
  const name = row.values.name?.trim();
  if (!name) return null;

  return {
    ...defaultProductFormValues,
    name,
    description: row.values.description?.trim() ?? "",
    sku: row.values.default_sku?.trim() ?? "",
    barcode: row.values.barcode?.trim() ?? "",
    classification: parseClassification(row.values.classification),
    base_unit_of_measure:
      row.values.base_unit_of_measure?.trim() || defaultProductFormValues.base_unit_of_measure,
    category_id: resolveCategoryId(row.values.category_name, categories),
    hsn_sac_code: row.values.hsn_sac_code?.trim() ?? "",
    has_variants: parseYesNo(row.values.has_variants, defaultProductFormValues.has_variants),
    default_tax_category: parseTaxCategory(row.values.default_tax_category),
    is_active: parseYesNo(row.values.is_active, true),
    is_purchasable: parseYesNo(row.values.is_purchasable, defaultProductFormValues.is_purchasable),
    is_salable: parseYesNo(row.values.is_salable, defaultProductFormValues.is_salable),
    is_returnable: parseYesNo(row.values.is_returnable, defaultProductFormValues.is_returnable),
    selling_price: row.values.selling_price?.trim() ?? "",
    mrp: row.values.mrp?.trim() ?? "",
    purchase_price: row.values.purchase_price?.trim() ?? "",
    selling_uom:
      row.values.base_unit_of_measure?.trim() || defaultProductFormValues.base_unit_of_measure,
    purchase_uom:
      row.values.base_unit_of_measure?.trim() || defaultProductFormValues.base_unit_of_measure,
  };
}

export async function parseProductListSpreadsheetFile(file: File): Promise<ParsedSpreadsheet> {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (extension === "csv") {
    const text = await file.text();
    return parseCsvText(text);
  }

  if (extension === "xlsx" || extension === "xls") {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0] ?? ""];
    if (!firstSheet) {
      return { headers: [], rows: [] };
    }
    const matrix = XLSX.utils.sheet_to_json<string[]>(firstSheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as string[][];
    const [headers = [], ...rows] = matrix;
    return {
      headers: headers.map((cell) => String(cell ?? "").trim()),
      rows: rows
        .filter((row) => row.some((cell) => String(cell ?? "").trim().length > 0))
        .map((row) => headers.map((_, index) => String(row[index] ?? "").trim())),
    };
  }

  throw new Error("Unsupported file type. Upload a CSV or Excel workbook.");
}

function parseCsvText(text: string): ParsedSpreadsheet {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const rows = lines.map(parseCsvLine);
  const [headers = [], ...body] = rows;
  return { headers, rows: body };
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  cells.push(current.trim());
  return cells;
}
