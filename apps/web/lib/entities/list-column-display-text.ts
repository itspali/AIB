import { formatDate } from "@/lib/dashboard/format";
import type { EntityListColumnId } from "@/lib/entities/list-columns";
import {
  ENTITY_TYPE_LABELS,
  PARTY_NATURE_LABELS,
  TAX_TREATMENT_LABELS,
} from "@/lib/entities/labels";
import type { EntityListRow } from "@/lib/entities/types";

export function getEntityListCellDisplayTexts(
  columnId: EntityListColumnId,
  row: EntityListRow
): string[] {
  switch (columnId) {
    case "name": {
      const texts = [row.name?.trim() || "—"];
      if (row.code?.trim()) texts.push(row.code.trim());
      return texts;
    }
    case "code":
      return [row.code?.trim() || "—"];
    case "type":
      return [ENTITY_TYPE_LABELS[row.type]];
    case "party_nature":
      return [PARTY_NATURE_LABELS[row.party_nature]];
    case "customer_category":
      return [row.customer_category_name?.trim() || "—"];
    case "supplier_category":
      return [row.supplier_category_name?.trim() || "—"];
    case "legal_name":
      return [row.legal_name?.trim() || "—"];
    case "tax_treatment":
      return [TAX_TREATMENT_LABELS[row.tax_treatment].label];
    case "tax_registration_number":
      return [row.tax_registration_number?.trim() || "—"];
    case "primary_contact_name":
      return [row.primary_contact_name?.trim() || "—"];
    case "primary_contact_email":
      return [row.primary_contact_email?.trim() || "—"];
    case "company_email":
      return [row.company_email?.trim() || "—"];
    case "company_phone":
      return [row.company_phone?.trim() || "—"];
    case "credit_limit":
    case "current_balance":
      return [row[columnId]];
    case "payment_terms_days":
      return [`${row.payment_terms_days} d`];
    case "is_active":
      return [row.is_active ? "Active" : "Inactive"];
    case "created_at":
    case "updated_at":
      return [formatDate(row[columnId])];
    default:
      return ["—"];
  }
}
