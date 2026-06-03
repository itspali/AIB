import type { CategoryListRow } from "@/lib/categories/list-row";
import { CATEGORY_LIST_COLUMNS } from "@/lib/categories/list-columns";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCell(row: CategoryListRow, columnId: string): string {
  switch (columnId) {
    case "name":
      return row.name;
    case "parent_name":
      return row.parent_name;
    case "is_active":
      return row.is_active ? "Active" : "Inactive";
    case "item_count":
      return String(row.item_count);
    case "default_variant_strategy":
      return row.default_variant_strategy.replace(/_/g, " ");
    case "default_item_type":
      return row.default_item_type?.replace(/_/g, " ") ?? "";
    case "attribute_count":
      return String(row.attribute_count);
    case "inherit_parent_attributes":
      return row.inherit_parent_attributes ? "Yes" : "No";
    case "created_at":
      return row.created_at;
    case "updated_at":
      return row.updated_at;
    default:
      return "";
  }
}

export function exportCategoryListRowsToCsv(rows: CategoryListRow[]): string {
  const exportColumns = CATEGORY_LIST_COLUMNS.filter((column) =>
    ["name", "parent_name", "is_active", "item_count", "updated_at"].includes(column.id)
  );

  const header = exportColumns.map((column) => escapeCsv(column.label)).join(",");
  const body = rows.map((row) =>
    exportColumns.map((column) => escapeCsv(formatCell(row, column.id))).join(",")
  );

  return [header, ...body].join("\r\n");
}

export function downloadCategoryListCsv(rows: CategoryListRow[], filename = "categories-export.csv") {
  const csv = exportCategoryListRowsToCsv(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
