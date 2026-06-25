import { classificationLabel } from "@/lib/products/classification-labels";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import {
  PRODUCT_LIST_COLUMNS,
  type ProductListColumnDef,
  type ProductListColumnId,
} from "@/lib/products/list-columns";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import type { ProductListRow } from "@/lib/products/types";

export type ProductListExportFormat = "csv" | "excel" | "pdf";

export type ProductListExportColumn = Pick<ProductListColumnDef, "id" | "label">;

export type ProductListExportMatrix = {
  headers: string[];
  rows: string[][];
  columnIds: ProductListColumnId[];
};

/** Portrait fits ~6 columns comfortably on A4; switch to landscape above that. */
export const PRODUCT_LIST_PDF_LANDSCAPE_MIN_COLUMNS = 7;

export function resolveProductListPdfLandscape(columnCount: number): boolean {
  return columnCount >= PRODUCT_LIST_PDF_LANDSCAPE_MIN_COLUMNS;
}

export function resolveProductListPdfOrientationLabel(columnCount: number): "portrait" | "landscape" {
  return resolveProductListPdfLandscape(columnCount) ? "landscape" : "portrait";
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatProductListExportCell(row: ProductListRow, columnId: ProductListColumnId): string {
  switch (columnId) {
    case "image":
      return row.image_url ?? "";
    case "name":
      return row.name;
    case "default_sku":
      return row.default_sku ?? "";
    case "barcode":
      return row.barcode ?? "";
    case "classification":
      return classificationLabel(row.classification);
    case "category_name":
      return row.category_name ?? "";
    case "description":
      return row.description ?? "";
    case "base_unit_of_measure":
      return row.base_unit_of_measure;
    case "hsn_sac_code":
      return row.hsn_sac_code ?? "";
    case "has_variants":
      return row.has_variants ? "Yes" : "No";
    case "default_tax_category":
      return taxCategoryLabel(row.default_tax_category);
    case "is_active":
      return row.is_active ? "Active" : "Inactive";
    case "is_purchasable":
      return row.is_purchasable ? "Yes" : "No";
    case "is_salable":
      return row.is_salable ? "Yes" : "No";
    case "is_returnable":
      return row.is_returnable ? "Yes" : "No";
    case "selling_price":
      return row.selling_price ?? "";
    case "mrp":
      return row.mrp ?? "";
    case "purchase_price":
      return row.purchase_price ?? "";
    case "supplier_name":
      return row.supplier_name ?? "";
    case "stock_on_hand":
      return row.stock_on_hand ?? "";
    case "created_at":
      return row.created_at;
    case "updated_at":
      return row.updated_at;
    default:
      return "";
  }
}

export function resolveProductListExportColumns(
  columnIds: ProductListColumnId[],
  fieldPermissions: ProductFieldPermissions
): ProductListExportColumn[] {
  const allowed = new Set(fieldPermissions.allowedFields);
  return columnIds
    .filter((id) => allowed.has(id))
    .map((id) => {
      const column = PRODUCT_LIST_COLUMNS.find((entry) => entry.id === id);
      return column ? { id: column.id, label: column.label } : null;
    })
    .filter((column): column is ProductListExportColumn => column != null);
}

export function buildProductListExportMatrix(
  rows: ProductListRow[],
  columnIds: ProductListColumnId[],
  fieldPermissions: ProductFieldPermissions
): ProductListExportMatrix {
  const columns = resolveProductListExportColumns(columnIds, fieldPermissions);
  const headers = columns.map((column) => column.label);
  const body = rows.map((row) =>
    columns.map((column) => formatProductListExportCell(row, column.id))
  );
  return {
    headers,
    rows: body,
    columnIds: columns.map((column) => column.id),
  };
}

export function productListExportMatrixToCsv(matrix: ProductListExportMatrix): string {
  const header = matrix.headers.map(escapeCsv).join(",");
  const body = matrix.rows.map((row) => row.map(escapeCsv).join(","));
  return [header, ...body].join("\r\n");
}

export function downloadExportBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function downloadProductListCsvFromMatrix(
  matrix: ProductListExportMatrix,
  filename = "items-export.csv"
) {
  const csv = productListExportMatrixToCsv(matrix);
  downloadExportBlob(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }), filename);
}

export async function downloadProductListExcelFromMatrix(
  matrix: ProductListExportMatrix,
  filename = "items-export.xlsx"
) {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet([matrix.headers, ...matrix.rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Items");
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadExportBlob(
    new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    filename
  );
}

export function renderProductListExportTableHtml(
  matrix: ProductListExportMatrix,
  title = "Items export",
  options?: { landscape?: boolean }
): string {
  const landscape = options?.landscape ?? resolveProductListPdfLandscape(matrix.headers.length);
  const tableFontSize = matrix.headers.length >= 10 ? "9px" : matrix.headers.length >= 7 ? "10px" : "11px";
  const headerCells = matrix.headers
    .map((label) => `<th style="padding:6px 8px;text-align:left;border:1px solid #ddd;">${escapeHtml(label)}</th>`)
    .join("");
  const bodyRows = matrix.rows
    .map(
      (row) =>
        `<tr>${row
          .map(
            (cell) =>
              `<td style="padding:6px 8px;border:1px solid #ddd;vertical-align:top;">${escapeHtml(cell)}</td>`
          )
          .join("")}</tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      @page { size: A4 ${landscape ? "landscape" : "portrait"}; margin: 12mm 10mm; }
      body { font-family: system-ui, sans-serif; font-size: ${tableFontSize}; color: #111; margin: 0; }
      h1 { font-size: 16px; margin: 0 0 12px; }
      table { border-collapse: collapse; width: 100%; table-layout: fixed; word-break: break-word; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** @deprecated Use buildProductListExportMatrix + downloadProductListCsvFromMatrix */
export function exportProductListRowsToCsv(
  rows: ProductListRow[],
  fieldPermissions: ProductFieldPermissions
): string {
  const matrix = buildProductListExportMatrix(
    rows,
    PRODUCT_LIST_COLUMNS.map((column) => column.id),
    fieldPermissions
  );
  return productListExportMatrixToCsv(matrix);
}

/** @deprecated Use downloadProductListCsvFromMatrix */
export function downloadProductListCsv(csv: string, filename = "item-masters-export.csv") {
  downloadExportBlob(new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" }), filename);
}
