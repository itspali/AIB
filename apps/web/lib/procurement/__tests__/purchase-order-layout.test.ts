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
import {
  getPoPeekLineColumns,
  getVisiblePoFormHeaderDetailsFields,
  getVisiblePoFormHeaderPrimaryFields,
  PO_FORM_FIELDS_GRID_CLASS,
  resolvePoFormFieldNarrowSpanClass,
  resolvePoFormFieldsGridProps,
} from "@/lib/documents/po-form-layout";
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

  it("includes sku in default line column order after item", () => {
    expect(DEFAULT_PO_SCREEN_LAYOUT.lineColumnOrder).toEqual([
      "item",
      "sku",
      "quantity_ordered",
      "unit",
      "unit_price",
      "mrp",
      "discount_pct",
      "discount_amount",
      "tax_rate_pct",
      "line_tax_amount",
      "cgst_amount",
      "sgst_amount",
      "igst_amount",
      "line_total",
    ]);
  });

  it("nests sku under item when enabled", () => {
    const layout = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "sku" ? { ...column, defaultVisible: true } : column
      ),
    };

    expect(getCompactPoTableColumns(layout).map((column) => column.id)).toEqual([
      "item",
      "quantity_ordered",
      "unit_price",
      "line_total",
    ]);
    expect(getNestedUnderItemPoLineColumns(layout).map((column) => column.id)).toEqual([
      "sku",
      VARIANT_ATTRIBUTES_ALL_ID,
    ]);
    expect(getPoLineEntryTableColumns(layout).map((column) => column.id)).not.toContain("sku");
  });

  it("shows sku as table column when lineSlot is column", () => {
    const layout = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "sku"
          ? { ...column, defaultVisible: true, lineSlot: "column" as const }
          : column
      ),
    };

    expect(getPoLineEntryTableColumns(layout).map((column) => column.id)).toContain("sku");
    expect(getNestedUnderItemPoLineColumns(layout).map((column) => column.id)).not.toContain(
      "sku"
    );
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

  it("orders primary header fields using headerFieldOrder", () => {
    const reordered = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      headerFieldOrder: [
        "currency",
        "supplier",
        "destination",
        "voucher_number",
        "payment_terms_days",
        "requisition_number",
        "expected_delivery_date",
        "internal_notes",
        "document_status",
        "updated_at",
      ] as typeof DEFAULT_PO_SCREEN_LAYOUT.headerFieldOrder,
    };

    expect(getVisiblePoFormHeaderPrimaryFields(reordered).map((field) => field.id)).toEqual([
      "currency",
      "supplier",
      "destination",
    ]);
  });

  it("orders details fields using headerFieldOrder", () => {
    const reordered = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      headerFieldOrder: [
        "supplier",
        "destination",
        "currency",
        "voucher_number",
        "internal_notes",
        "expected_delivery_date",
        "requisition_number",
        "payment_terms_days",
        "document_status",
        "updated_at",
      ] as typeof DEFAULT_PO_SCREEN_LAYOUT.headerFieldOrder,
    };

    expect(getVisiblePoFormHeaderDetailsFields(reordered).map((field) => field.id)).toEqual([
      "internal_notes",
      "expected_delivery_date",
      "requisition_number",
      "payment_terms_days",
      "tax_supply_nature",
    ]);
  });

  it("inserts received qty into peek columns after ordered qty", () => {
    expect(getPoPeekLineColumns(DEFAULT_PO_SCREEN_LAYOUT).map((column) => column.id)).toEqual([
      "item",
      "quantity_ordered",
      "quantity_received",
      "unit_price",
      "line_total",
    ]);
  });

  it("excludes item_detail sku from peek table columns", () => {
    const layout = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "sku"
          ? { ...column, defaultVisible: true, lineSlot: "item_detail" as const }
          : column
      ),
    };

    expect(getPoPeekLineColumns(layout).map((column) => column.id)).not.toContain("sku");
  });
});

describe("po form fields grid", () => {
  it("uses responsive multi-column grid when two or more fields are visible", () => {
    expect(resolvePoFormFieldsGridProps(1).gridClassName).toContain("grid-cols-1");
    expect(resolvePoFormFieldsGridProps(2).gridClassName).toContain(PO_FORM_FIELDS_GRID_CLASS);
    expect(resolvePoFormFieldsGridProps(2).gridClassName).not.toContain("--3");
    expect(resolvePoFormFieldsGridProps(2).containerClassName).toContain(
      "po-form-fields-grid-container"
    );
    expect(resolvePoFormFieldsGridProps(3).gridClassName).toContain("po-form-fields-grid--3");
    expect(resolvePoFormFieldsGridProps(4).gridClassName).toContain("po-form-fields-grid--4");
  });

  it("forces single column for the side rail", () => {
    expect(resolvePoFormFieldsGridProps(4, true).gridClassName).toContain("grid-cols-1");
  });

  it("keeps strict two-column rows on narrow layouts (no orphan spanning)", () => {
    const headerFields = [{ id: "supplier" }, { id: "destination" }, { id: "currency" }];
    expect(resolvePoFormFieldNarrowSpanClass(2, headerFields)).toBe("");
  });
});
