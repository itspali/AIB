import { formatCurrency, formatDate } from "@/lib/dashboard/format";
import { classificationLabel } from "@/lib/products/classification-labels";
import { resolveProductListRowPresentation } from "@/lib/products/list-row-presentation";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import type { ProductListRow } from "@/lib/products/types";
import type { ProductListColumnId } from "@/lib/products/list-columns";

function formatOptionalCurrency(value: string | null): string {
  if (!value || value.trim() === "") return "—";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? formatCurrency(parsed) : value;
}

function formatBooleanText(value: boolean): string {
  return value ? "Yes" : "No";
}

function formatActiveStatusText(value: boolean): string {
  return value ? "Active" : "Inactive";
}

export type ProductListCellDisplayTextOptions = {
  showVariants?: boolean;
};

/** Plain-text values used to auto-fit column width to header or cell content. */
export function getProductListCellDisplayTexts(
  columnId: ProductListColumnId,
  product: ProductListRow,
  options?: ProductListCellDisplayTextOptions
): string[] {
  switch (columnId) {
    case "image":
      return [];
    case "name": {
      const showVariants = options?.showVariants ?? false;
      const presentation = resolveProductListRowPresentation(product, showVariants);
      const name = product.name?.trim() || "—";
      const texts = [name];
      if (presentation.attributeSubline) {
        texts.push(presentation.attributeSubline);
      }
      return texts;
    }
    case "default_sku": {
      const showVariants = options?.showVariants ?? false;
      const presentation = resolveProductListRowPresentation(product, showVariants);
      return [presentation.displaySku ?? "—"];
    }
    case "barcode":
      return [product.barcode ?? "—"];
    case "classification":
      return [classificationLabel(product.classification)];
    case "category_name":
      return [product.category_name?.trim() || "—"];
    case "description":
      return [product.description?.trim() || "—"];
    case "base_unit_of_measure":
      return [product.base_unit_of_measure];
    case "hsn_sac_code":
      return [product.hsn_sac_code ?? "—"];
    case "has_variants":
      return [formatBooleanText(product.has_variants)];
    case "default_tax_category":
      return [taxCategoryLabel(product.default_tax_category)];
    case "is_active":
      return [formatActiveStatusText(product.is_active)];
    case "is_purchasable":
      return [formatBooleanText(product.is_purchasable)];
    case "is_salable":
      return [formatBooleanText(product.is_salable)];
    case "is_returnable":
      return [formatBooleanText(product.is_returnable)];
    case "selling_price":
      return [formatOptionalCurrency(product.selling_price)];
    case "purchase_price":
      return [formatOptionalCurrency(product.purchase_price)];
    case "supplier_name":
      return [product.supplier_name?.trim() || "—"];
    case "stock_on_hand": {
      const qty = product.stock_on_hand;
      if (qty == null || qty.trim() === "") return ["—"];
      const parsed = Number(qty);
      return [Number.isFinite(parsed) ? parsed.toLocaleString() : qty];
    }
    case "created_at":
      return [formatDate(product.created_at)];
    case "updated_at":
      return [formatDate(product.updated_at)];
    default:
      return ["—"];
  }
}
