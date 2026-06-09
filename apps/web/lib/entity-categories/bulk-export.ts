import type { EntityCategoryListRow } from "@/lib/entity-categories/list-row";
import { getEntityCategoryListColumnRegistry } from "@/lib/entity-categories/list-columns";
import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCell(row: EntityCategoryListRow, columnId: string): string {
  switch (columnId) {
    case "name":
      return row.name;
    case "parent_name":
      return row.parent_name;
    case "is_active":
      return row.is_active ? "Active" : "Inactive";
    case "entity_count":
      return String(row.entity_count);
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

export function exportEntityCategoryListRowsToCsv(
  workspace: EntityCategoryWorkspace,
  rows: EntityCategoryListRow[]
): string {
  const columns = getEntityCategoryListColumnRegistry(workspace).columns.filter((column) =>
    ["name", "parent_name", "is_active", "entity_count", "updated_at"].includes(column.id)
  );

  const header = columns.map((column) => escapeCsv(column.label)).join(",");
  const body = rows.map((row) =>
    columns.map((column) => escapeCsv(formatCell(row, column.id))).join(",")
  );

  return [header, ...body].join("\r\n");
}

export function downloadEntityCategoryListCsv(
  workspace: EntityCategoryWorkspace,
  rows: EntityCategoryListRow[],
  filename?: string
) {
  const defaultName =
    workspace === "customer" ? "customer-categories-export.csv" : "supplier-categories-export.csv";
  const csv = exportEntityCategoryListRowsToCsv(workspace, rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename ?? defaultName;
  link.click();
  URL.revokeObjectURL(url);
}
