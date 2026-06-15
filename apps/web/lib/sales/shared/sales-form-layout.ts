import {
  DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  ensureSalesCommerceDrawerLineColumns,
  getColumnSalesLineFields,
  getSalesLayoutColumnPref,
  getVisibleSalesHeaderFields,
  normalizeSalesCommerceLayoutTemplate,
  resolveSalesHeaderFieldSlot,
  type SalesLineColumnVisibilityOptions,
} from "@/lib/sales/shared/sales-commerce-layout";
import type { DocumentColumnPref, DocumentLayoutDefaults } from "@/lib/documents/types";

export const SALES_FORM_FIELDS_GRID_CONTAINER_CLASS = "po-form-fields-grid-container";

export const SALES_FORM_FIELDS_GRID_CLASS = "po-form-fields-grid";

export type SalesFormFieldsGridProps = {
  containerClassName: string;
  gridClassName: string;
};

function salesFormFieldsGridModifier(fieldCount: number): string {
  if (fieldCount <= 2) return "";
  if (fieldCount === 3) return "po-form-fields-grid--3";
  return "po-form-fields-grid--4";
}

export function resolveSalesFormFieldNarrowSpanClass(
  _index: number,
  _fields: readonly { id: string }[],
  _layout: "stack" | "rail" = "stack"
): string {
  return "";
}

export function resolveSalesFormFieldsGridProps(
  fieldCount: number,
  singleColumn = false
): SalesFormFieldsGridProps {
  if (singleColumn || fieldCount <= 1) {
    return {
      containerClassName: "w-full min-w-0",
      gridClassName: "grid w-full grid-cols-1",
    };
  }
  return {
    containerClassName: `${SALES_FORM_FIELDS_GRID_CONTAINER_CLASS} w-full min-w-0`,
    gridClassName: [SALES_FORM_FIELDS_GRID_CLASS, salesFormFieldsGridModifier(fieldCount)]
      .filter(Boolean)
      .join(" "),
  };
}

export function getVisibleSalesFormHeaderPrimaryFields(
  layout: DocumentLayoutDefaults = DEFAULT_SALES_ORDER_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return getVisibleSalesHeaderFields(normalizeSalesCommerceLayoutTemplate(layout)).filter(
    (field) => resolveSalesHeaderFieldSlot(field) === "primary"
  );
}

export function getVisibleSalesFormHeaderDetailsFields(
  layout: DocumentLayoutDefaults = DEFAULT_SALES_ORDER_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return getVisibleSalesHeaderFields(normalizeSalesCommerceLayoutTemplate(layout)).filter(
    (field) => resolveSalesHeaderFieldSlot(field) === "details" && field.id !== "internal_notes"
  );
}

export function getVisibleSalesFormHeaderNotesField(
  layout: DocumentLayoutDefaults = DEFAULT_SALES_ORDER_SCREEN_LAYOUT
): DocumentColumnPref | undefined {
  const field = getSalesLayoutColumnPref(normalizeSalesCommerceLayoutTemplate(layout), "internal_notes");
  return field?.defaultVisible ? field : undefined;
}

export function getSalesPeekLineColumns(
  layout: DocumentLayoutDefaults = DEFAULT_SALES_ORDER_SCREEN_LAYOUT,
  options?: Pick<SalesLineColumnVisibilityOptions, "allowLineItemDiscounts">
): DocumentColumnPref[] {
  const normalized = normalizeSalesCommerceLayoutTemplate(layout);
  let visibleLine = getColumnSalesLineFields(normalized);
  if (options?.allowLineItemDiscounts === false) {
    visibleLine = visibleLine.filter(
      (column) => column.id !== "discount_pct" && column.id !== "discount_amount"
    );
  }
  return ensureSalesCommerceDrawerLineColumns(visibleLine, normalized, options);
}
