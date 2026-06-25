import { formatDate } from "@/lib/dashboard/format";
import { formatListCurrency, formatListQuantity } from "@/lib/list-columns/format-list-value";
import { classificationLabel } from "@/lib/products/classification-labels";
import { getColumnDef, type ProductListColumnId } from "@/lib/products/list-columns";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import type { ProductListRow } from "@/lib/products/types";

/** Core registry columns — matches the matrix mock (ID, name, value). */
export const MATRIX_REGISTRY_CORE_COLUMNS: ProductListColumnId[] = [
  "default_sku",
  "name",
  "selling_price",
];

const MATRIX_HEADER_LABELS: Partial<Record<ProductListColumnId, string>> = {
  name: "Item name",
};

export function matrixRegistryHeaderLabel(columnId: ProductListColumnId): string {
  const label = MATRIX_HEADER_LABELS[columnId] ?? getColumnDef(columnId).label;
  return label.toUpperCase();
}

function formatSku(row: ProductListRow): string {
  const sku = row.default_sku?.trim();
  if (!sku) return `#${row.id.slice(0, 8).toUpperCase()}`;
  return sku.startsWith("#") ? sku : `#${sku}`;
}

function formatBoolean(value: boolean): string {
  return value ? "Yes" : "No";
}

export function renderMatrixRegistryCell(
  columnId: ProductListColumnId,
  row: ProductListRow
): string {
  switch (columnId) {
    case "image":
      return "—";
    case "name":
      return row.name;
    case "default_sku":
      return formatSku(row);
    case "barcode":
      return row.barcode ?? "—";
    case "classification":
      return classificationLabel(row.classification);
    case "category_name":
      return row.category_name ?? "—";
    case "description":
      return row.description ?? "—";
    case "base_unit_of_measure":
      return row.base_unit_of_measure;
    case "hsn_sac_code":
      return row.hsn_sac_code ?? "—";
    case "has_variants":
      return formatBoolean(row.has_variants);
    case "default_tax_category":
      return taxCategoryLabel(row.default_tax_category);
    case "is_active":
      return row.is_active ? "Active" : "Inactive";
    case "is_purchasable":
      return formatBoolean(row.is_purchasable);
    case "is_salable":
      return formatBoolean(row.is_salable);
    case "is_returnable":
      return formatBoolean(row.is_returnable);
    case "selling_price":
      return formatListCurrency(row.selling_price);
    case "mrp":
      return formatListCurrency(row.mrp);
    case "purchase_price":
      return formatListCurrency(row.purchase_price);
    case "supplier_name":
      return row.supplier_name ?? "—";
    case "stock_on_hand":
      return formatListQuantity(row.stock_on_hand);
    case "created_at":
      return formatDate(row.created_at);
    case "updated_at":
      return formatDate(row.updated_at);
    default:
      return "—";
  }
}

/** Matrix registry surface: core columns only, preserving user order within the registry set. */
export function resolveMatrixRegistryDisplayColumns(
  userVisible: ProductListColumnId[]
): ProductListColumnId[] {
  const coreSet = new Set<ProductListColumnId>(MATRIX_REGISTRY_CORE_COLUMNS);
  const ordered = userVisible.filter((columnId) => coreSet.has(columnId));
  return ordered.length > 0 ? ordered : MATRIX_REGISTRY_CORE_COLUMNS;
}
