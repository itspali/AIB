import { formatDate } from "@/lib/dashboard/format";
import type { UomListColumnId } from "@/lib/uom/list-columns";
import { uomFamilyLabel, type UomRow } from "@/lib/uom/types";

export function formatUomFactorSummary(row: UomRow): string {
  return row.is_family_base ? "1 (base)" : String(row.factor_to_base);
}

export function getUomCellDisplayTexts(columnId: UomListColumnId, row: UomRow): string[] {
  switch (columnId) {
    case "code":
      return [row.code];
    case "name":
      return [row.name];
    case "family":
      return [uomFamilyLabel(row.family)];
    case "factor_to_base":
      return [formatUomFactorSummary(row)];
    case "is_family_base":
      return [row.is_family_base ? "Yes" : "No"];
    case "is_active":
      return [row.is_active ? "Active" : "Inactive"];
    case "updated_at":
      return [formatDate(row.updated_at)];
    default:
      return ["—"];
  }
}
