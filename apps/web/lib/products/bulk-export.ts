import { classificationLabel } from "@/lib/products/classification-labels";
import type { ProductFieldPermissions } from "@/lib/products/field-permissions";
import { PRODUCT_LIST_COLUMNS } from "@/lib/products/list-columns";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import type { ProductListRow } from "@/lib/products/types";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCell(row: ProductListRow, columnId: string): string {
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

export function exportProductListRowsToCsv(
  rows: ProductListRow[],
  fieldPermissions: ProductFieldPermissions
): string {
  const columns = PRODUCT_LIST_COLUMNS.filter((column) =>
    fieldPermissions.allowedFields.includes(column.id)
  );

  const header = columns.map((column) => escapeCsv(column.label)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsv(formatCell(row, column.id))).join(",")
  );

  return [header, ...body].join("\r\n");
}

export function downloadProductListCsv(csv: string, filename = "item-masters-export.csv") {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
