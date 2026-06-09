import { describe, expect, it } from "vitest";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  getColumnLineFields,
  getCompactPoTableColumns,
  getItemDetailLineFields,
  getNestedUnderItemPoLineColumns,
  getVisibleCatalogLineFields,
  getVisiblePoLineColumns,
  getPoLineEntryTableColumns,
  isPoHeaderFieldVisible,
  movePoLineColumnOrder,
  patchPoLayoutColumn,
} from "@/lib/documents/purchase-order-layout";
import { VARIANT_ATTRIBUTES_ALL_ID } from "@/lib/documents/catalog-field-ids";

describe("purchase-order-layout compact columns", () => {
  it("splits visible columns into primary table vs nested-under-item", () => {
    const visible = getVisiblePoLineColumns(DEFAULT_PO_SCREEN_LAYOUT);
    const primary = getCompactPoTableColumns(DEFAULT_PO_SCREEN_LAYOUT);
    const nested = getNestedUnderItemPoLineColumns(DEFAULT_PO_SCREEN_LAYOUT);

    expect(primary.map((column) => column.id)).toEqual([
      "item",
      "quantity_ordered",
      "unit_price",
      "line_total",
    ]);
    expect(nested.map((column) => column.id)).toEqual([VARIANT_ATTRIBUTES_ALL_ID]);
    expect(primary.length + nested.length).toBeGreaterThanOrEqual(visible.length);
  });

  it("nests optional visible columns under item", () => {
    const layout = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "unit" ? { ...column, defaultVisible: true } : column
      ),
    };

    expect(getNestedUnderItemPoLineColumns(layout).map((column) => column.id)).toEqual([
      "unit",
      VARIANT_ATTRIBUTES_ALL_ID,
    ]);
    expect(getCompactPoTableColumns(layout).map((column) => column.id)).toEqual([
      "item",
      "quantity_ordered",
      "unit_price",
      "line_total",
    ]);
  });

  it("reorders primary table columns when line order changes", () => {
    const reordered = movePoLineColumnOrder(
      DEFAULT_PO_SCREEN_LAYOUT,
      "line_total",
      "quantity_ordered"
    );

    expect(getCompactPoTableColumns(reordered).map((column) => column.id)).toEqual([
      "item",
      "line_total",
      "quantity_ordered",
      "unit_price",
    ]);
  });

  it("moves qty to item detail when lineSlot is item_detail", () => {
    const layout = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "quantity_ordered"
          ? { ...column, lineSlot: "item_detail" as const, itemDetailFlow: "new_line" as const }
          : column
      ),
    };

    expect(getColumnLineFields(layout).map((column) => column.id)).toEqual([
      "item",
      "unit_price",
      "line_total",
    ]);
    expect(getItemDetailLineFields(layout).map((column) => column.id)).toEqual([
      "quantity_ordered",
      VARIANT_ATTRIBUTES_ALL_ID,
    ]);
  });

  it("includes visible catalog fields in item detail fields", () => {
    expect(getVisibleCatalogLineFields(DEFAULT_PO_SCREEN_LAYOUT).map((column) => column.id)).toEqual([
      VARIANT_ATTRIBUTES_ALL_ID,
    ]);
  });

  it("adds image column when imageDisplayMode is SEPARATE_COLUMN", () => {
    const layout = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      imageDisplayMode: "SEPARATE_COLUMN" as const,
    };
    expect(getPoLineEntryTableColumns(layout).map((column) => column.id)).toEqual([
      "line_image",
      "item",
      "quantity_ordered",
      "unit_price",
      "line_total",
    ]);
  });

  it("respects header field visibility from layout prefs", () => {
    expect(isPoHeaderFieldVisible("supplier", DEFAULT_PO_SCREEN_LAYOUT)).toBe(true);
    expect(isPoHeaderFieldVisible("updated_at", DEFAULT_PO_SCREEN_LAYOUT)).toBe(false);

    const hiddenSupplier = patchPoLayoutColumn(DEFAULT_PO_SCREEN_LAYOUT, "supplier", {
      defaultVisible: false,
    });
    expect(isPoHeaderFieldVisible("supplier", hiddenSupplier)).toBe(false);
  });
});
