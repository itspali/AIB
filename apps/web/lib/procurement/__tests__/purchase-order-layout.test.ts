import { describe, expect, it } from "vitest";
import {
  DEFAULT_PO_SCREEN_LAYOUT,
  DEFAULT_PO_TOTALS_FIELD_ORDER,
  addPoCatalogField,
  createPoCatalogFieldPref,
  getColumnLineFields,
  getCompactPoTableColumns,
  getItemDetailLineFields,
  getNestedUnderItemPoLineColumns,
  getPoLineSettingsColumnOrder,
  getVisibleCatalogLineFields,
  getVisiblePoLineColumns,
  getPoLineEntryTableColumns,
  isPoFormHeaderPlaceableField,
  isPoHeaderFieldVisible,
  movePoLineColumnOrder,
  normalizePoLayoutTemplate,
  patchPoLayoutColumn,
  removePoCatalogField,
  resolveHeaderFieldSlot,
} from "@/lib/documents/purchase-order-layout";
import {
  getPoPeekLineColumns,
  getVisiblePoFormHeaderDetailsFields,
  getVisiblePoFormHeaderNotesField,
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
      "expected_delivery_date",
      "requisition_number",
      "payment_terms_days",
      "tax_supply_nature",
    ]);
    expect(getVisiblePoFormHeaderNotesField(reordered)?.id).toBe("internal_notes");
  });

  it("routes header fields by headerSlot", () => {
    const layout = patchPoLayoutColumn(DEFAULT_PO_SCREEN_LAYOUT, "payment_terms_days", {
      headerSlot: "primary",
    });

    expect(getVisiblePoFormHeaderPrimaryFields(layout).map((field) => field.id)).toContain(
      "payment_terms_days"
    );
    expect(getVisiblePoFormHeaderDetailsFields(layout).map((field) => field.id)).not.toContain(
      "payment_terms_days"
    );
    expect(resolveHeaderFieldSlot(getVisiblePoFormHeaderPrimaryFields(layout)[0]!)).toBe(
      "primary"
    );
  });

  it("backfills headerSlot from legacy defaults", () => {
    const supplier = DEFAULT_PO_SCREEN_LAYOUT.columns.find((column) => column.id === "supplier");
    expect(supplier?.headerSlot).toBe("primary");
    expect(isPoFormHeaderPlaceableField("supplier")).toBe(true);
    expect(isPoFormHeaderPlaceableField("voucher_number")).toBe(false);
  });

  it("excludes internal line columns from settings order", () => {
    expect(getPoLineSettingsColumnOrder(DEFAULT_PO_SCREEN_LAYOUT)).not.toContain("discount_amount");
    expect(getPoLineSettingsColumnOrder(DEFAULT_PO_SCREEN_LAYOUT)).not.toContain("tax_rate_pct");
    expect(getPoLineSettingsColumnOrder(DEFAULT_PO_SCREEN_LAYOUT)).toContain("discount_pct");
    expect(getPoLineSettingsColumnOrder(DEFAULT_PO_SCREEN_LAYOUT)).toContain("line_tax_amount");
  });

  it("folds legacy visible disc amount into discount column on normalize", () => {
    const layout = normalizePoLayoutTemplate({
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "discount_amount"
          ? { ...column, defaultVisible: true }
          : column.id === "discount_pct"
            ? { ...column, defaultVisible: false }
            : column
      ),
    });

    expect(
      layout.columns.find((column) => column.id === "discount_amount")?.defaultVisible
    ).toBe(false);
    expect(
      layout.columns.find((column) => column.id === "discount_pct")?.defaultVisible
    ).toBe(true);
  });

  it("removes catalog fields from order and columns", () => {
    const customPref = createPoCatalogFieldPref("item_custom_field", "brand");
    const withCatalog = addPoCatalogField(DEFAULT_PO_SCREEN_LAYOUT, customPref);
    const removed = removePoCatalogField(withCatalog, customPref.id);

    expect(removed.catalogLineFieldOrder).not.toContain(customPref.id);
    expect(removed.columns.some((column) => column.id === customPref.id)).toBe(false);
  });

  it("re-adds removed catalog fields", () => {
    const customPref = createPoCatalogFieldPref("item_custom_field", "brand");
    const removed = removePoCatalogField(
      addPoCatalogField(DEFAULT_PO_SCREEN_LAYOUT, customPref),
      customPref.id
    );
    const restored = addPoCatalogField(removed, customPref);

    expect(restored.catalogLineFieldOrder).toContain(customPref.id);
    expect(restored.columns.some((column) => column.id === customPref.id)).toBe(true);
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

  it("hides MRP line fields when procurement MRP/trade terms is disabled", () => {
    const layoutWithMrpColumn = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "mrp"
          ? { ...column, defaultVisible: true, lineSlot: "column" as const }
          : column
      ),
    };
    const layoutWithMrpItemDetail = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "mrp" ? { ...column, defaultVisible: true } : column
      ),
    };

    expect(
      getPoLineEntryTableColumns(layoutWithMrpColumn, { enableMrpTradeTerms: false }).map(
        (column) => column.id
      )
    ).not.toContain("mrp");
    expect(
      getPoPeekLineColumns(layoutWithMrpColumn, { enableMrpTradeTerms: false }).map(
        (column) => column.id
      )
    ).not.toContain("mrp");
    expect(
      getItemDetailLineFields(layoutWithMrpItemDetail, { enableMrpTradeTerms: false }).map(
        (column) => column.id
      )
    ).not.toContain("mrp");
    expect(
      getPoLineEntryTableColumns(layoutWithMrpColumn, { enableMrpTradeTerms: true }).map(
        (column) => column.id
      )
    ).toContain("mrp");
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

describe("po totals field order", () => {
  it("pins grand total after charge fields for legacy saved order", () => {
    const normalized = normalizePoLayoutTemplate({
      ...DEFAULT_PO_SCREEN_LAYOUT,
      totalsFieldOrder: [
        "line_count",
        "subtotal_ex_tax",
        "transaction_discount",
        "tax_amount",
        "grand_total",
        "shipping_amount",
        "shipping_tax_amount",
        "round_off_amount",
        "additional_charges_amount",
      ],
    });

    expect(normalized.totalsFieldOrder).toEqual([
      "line_count",
      "subtotal_ex_tax",
      "transaction_discount",
      "tax_amount",
      "shipping_amount",
      "shipping_tax_amount",
      "round_off_amount",
      "additional_charges_amount",
      "grand_total",
    ]);
  });

  it("pins transaction discount between subtotal and tax", () => {
    expect(DEFAULT_PO_TOTALS_FIELD_ORDER.indexOf("transaction_discount")).toBe(
      DEFAULT_PO_TOTALS_FIELD_ORDER.indexOf("subtotal_ex_tax") + 1
    );
    expect(DEFAULT_PO_TOTALS_FIELD_ORDER.indexOf("tax_amount")).toBe(
      DEFAULT_PO_TOTALS_FIELD_ORDER.indexOf("transaction_discount") + 1
    );
  });

  it("defaults grand total label to Grand total", () => {
    const grandTotal = DEFAULT_PO_SCREEN_LAYOUT.columns.find((column) => column.id === "grand_total");
    expect(grandTotal?.label).toBe("Grand total");
  });
});
