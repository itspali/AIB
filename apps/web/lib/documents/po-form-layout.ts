import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getColumnLineFields,
  getPoLayoutColumnPref,
  getVisibleHeaderFields,
  normalizePoLayoutTemplate,
  resolveHeaderFieldSlot,
} from "@/lib/documents/purchase-order-layout";
import type { DocumentColumnPref, DocumentLayoutDefaults } from "@/lib/documents/types";

/** Width-query container — grid column rules target the inner `.po-form-fields-grid`. */
export const PO_FORM_FIELDS_GRID_CONTAINER_CLASS = "po-form-fields-grid-container";

/** Marker class for responsive column counts in globals.css. */
export const PO_FORM_FIELDS_GRID_CLASS = "po-form-fields-grid";

export type PoFormFieldsGridProps = {
  containerClassName: string;
  gridClassName: string;
};

/** Modifier for container-query column caps (base grid is always 2 cols in globals.css). */
function poFormFieldsGridModifier(fieldCount: number): string {
  if (fieldCount <= 2) return "";
  if (fieldCount === 3) return "po-form-fields-grid--3";
  return "po-form-fields-grid--4";
}

/**
 * @deprecated Orphan spanning removed — narrow layouts keep a strict 2-column grid.
 */
export function resolvePoFormFieldNarrowSpanClass(
  _index: number,
  _fields: readonly { id: string }[],
  _layout: "stack" | "rail" = "stack"
): string {
  return "";
}

/** @deprecated Use resolvePoFormFieldsGridProps */
export function resolvePoFormFieldsGridClass(fieldCount: number, singleColumn = false): string {
  return resolvePoFormFieldsGridProps(fieldCount, singleColumn).gridClassName;
}

export function resolvePoFormFieldsGridProps(
  fieldCount: number,
  singleColumn = false
): PoFormFieldsGridProps {
  if (singleColumn || fieldCount <= 1) {
    return {
      containerClassName: "w-full min-w-0",
      gridClassName: "grid w-full grid-cols-1",
    };
  }
  return {
    containerClassName: `${PO_FORM_FIELDS_GRID_CONTAINER_CLASS} w-full min-w-0`,
    gridClassName: [PO_FORM_FIELDS_GRID_CLASS, poFormFieldsGridModifier(fieldCount)]
      .filter(Boolean)
      .join(" "),
  };
}

export function getVisiblePoFormHeaderPrimaryFields(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return getVisibleHeaderFields(normalizePoLayoutTemplate(layout)).filter(
    (field) => resolveHeaderFieldSlot(field) === "primary"
  );
}

export function getVisiblePoFormHeaderDetailsFields(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  return getVisibleHeaderFields(normalizePoLayoutTemplate(layout)).filter(
    (field) => resolveHeaderFieldSlot(field) === "details"
  );
}

/** Table columns for peek — column-slot line fields only (+ optional received qty). */
export function getPoPeekLineColumns(
  layout: DocumentLayoutDefaults = DEFAULT_PO_SCREEN_LAYOUT
): DocumentColumnPref[] {
  const normalized = normalizePoLayoutTemplate(layout);
  const visibleLine = getColumnLineFields(normalized);
  const receivedPref = getPoLayoutColumnPref(normalized, "quantity_received");
  if (!receivedPref?.defaultVisible) return visibleLine;

  const columns = [...visibleLine];
  const qtyIndex = columns.findIndex((column) => column.id === "quantity_ordered");
  if (qtyIndex >= 0) {
    columns.splice(qtyIndex + 1, 0, receivedPref);
    return columns;
  }
  return [...columns, receivedPref];
}
