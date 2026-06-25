import { formatDate } from "@/lib/dashboard/format";
import { formatListCurrency, formatListQuantity } from "@/lib/list-columns/format-list-value";
import { classificationLabel } from "@/lib/products/classification-labels";
import { resolveProductListRowPresentation } from "@/lib/products/list-row-presentation";
import { taxCategoryLabel } from "@/lib/products/tax-options";
import type { ProductListRow } from "@/lib/products/types";
import type { ProductListColumnId } from "@/lib/products/list-columns";
import { isBlankMatrixDisplayValue } from "@/lib/layout/matrix-blank-value";

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
      return [formatListCurrency(product.selling_price)];
    case "mrp":
      return [formatListCurrency(product.mrp)];
    case "purchase_price":
      return [formatListCurrency(product.purchase_price)];
    case "supplier_name":
      return [product.supplier_name?.trim() || "—"];
    case "stock_on_hand":
      return [formatListQuantity(product.stock_on_hand)];
    case "created_at":
      return [formatDate(product.created_at)];
    case "updated_at":
      return [formatDate(product.updated_at)];
    default:
      return ["—"];
  }
}

/** True when a matrix table cell has no value to render (skip accent/underline styling). */
export function isProductListMatrixCellBlank(
  columnId: ProductListColumnId,
  product: ProductListRow,
  options?: ProductListCellDisplayTextOptions
): boolean {
  if (columnId === "image") return true;
  const texts = getProductListCellDisplayTexts(columnId, product, options);
  if (texts.length === 0) return true;
  return texts.every((text) => isBlankMatrixDisplayValue(text));
}
