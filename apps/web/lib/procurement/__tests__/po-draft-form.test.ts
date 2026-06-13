import { describe, expect, it } from "vitest";
import {
  createEmptyPoLine,
  copyPoDraftFromOrder,
  defaultPoDraftForm,
  ensureLeadingPoLine,
  ensureTrailingPoLine,
  filterSavablePoLines,
  isPoLineComplete,
  mapPurchaseOrderToDraft,
  mapSavedPoLineToDraftLine,
  movePoDraftLine,
  normalizePoLinesForAnchor,
  poLinesNeedAnchorNormalization,
  supplierDefaultCurrency,
} from "@/lib/procurement/purchase-orders/draft-form";

describe("po draft form line helpers", () => {
  it("treats variant + positive qty as complete", () => {
    const line = {
      ...createEmptyPoLine(),
      variant_id: "b162d4b9-0c3e-5d6f-9a2b-3c4d5e6f7a8b",
      quantity_ordered: "1",
    };
    expect(isPoLineComplete(line)).toBe(true);
  });

  it("appends a trailing blank row when the last line is complete", () => {
    const complete = {
      ...createEmptyPoLine(),
      variant_id: "b162d4b9-0c3e-5d6f-9a2b-3c4d5e6f7a8b",
      quantity_ordered: "2",
    };
    const next = ensureTrailingPoLine([complete]);
    expect(next).toHaveLength(2);
    expect(isPoLineComplete(next[1]!)).toBe(false);
  });

  it("prepends a leading blank row when the first line is complete", () => {
    const complete = {
      ...createEmptyPoLine(),
      variant_id: "b162d4b9-0c3e-5d6f-9a2b-3c4d5e6f7a8b",
      quantity_ordered: "2",
    };
    const next = ensureLeadingPoLine([complete]);
    expect(next).toHaveLength(2);
    expect(isPoLineComplete(next[0]!)).toBe(false);
    expect(next[1]).toEqual(complete);
  });

  it("moves the blank entry row when normalizing for top anchor", () => {
    const complete = {
      ...createEmptyPoLine(),
      variant_id: "b162d4b9-0c3e-5d6f-9a2b-3c4d5e6f7a8b",
      quantity_ordered: "2",
    };
    const trailing = createEmptyPoLine();
    const normalized = normalizePoLinesForAnchor([complete, trailing], "top");
    expect(normalized).toHaveLength(2);
    expect(isPoLineComplete(normalized[0]!)).toBe(false);
    expect(normalized[1]?.variant_id).toBe(complete.variant_id);
  });

  it("reorders filled lines and keeps the trailing blank entry row", () => {
    const lineA = {
      ...createEmptyPoLine(),
      key: "line-a",
      variant_id: "variant-a",
      item_name: "Alpha",
      quantity_ordered: "1",
    };
    const lineB = {
      ...createEmptyPoLine(),
      key: "line-b",
      variant_id: "variant-b",
      item_name: "Beta",
      quantity_ordered: "2",
    };
    const blank = createEmptyPoLine();
    const reordered = movePoDraftLine([lineA, lineB, blank], "line-b", "line-a", "bottom");
    expect(reordered.map((line) => line.key)).toEqual(["line-b", "line-a", blank.key]);
  });

  it("can insert after the drop target when requested", () => {
    const lineA = {
      ...createEmptyPoLine(),
      key: "line-a",
      variant_id: "variant-a",
      quantity_ordered: "1",
    };
    const lineB = {
      ...createEmptyPoLine(),
      key: "line-b",
      variant_id: "variant-b",
      quantity_ordered: "2",
    };
    const lineC = {
      ...createEmptyPoLine(),
      key: "line-c",
      variant_id: "variant-c",
      quantity_ordered: "3",
    };
    const blank = createEmptyPoLine();
    const reordered = movePoDraftLine(
      [lineA, lineB, lineC, blank],
      "line-a",
      "line-b",
      "bottom",
      "after"
    );
    expect(reordered.map((line) => line.key)).toEqual([
      "line-b",
      "line-a",
      "line-c",
      blank.key,
    ]);
  });

  it("ignores reorder when either row is the blank entry line", () => {
    const complete = {
      ...createEmptyPoLine(),
      variant_id: "variant-a",
      quantity_ordered: "1",
    };
    const blank = createEmptyPoLine();
    const lines = [complete, blank];
    expect(movePoDraftLine(lines, blank.key, complete.key, "bottom")).toEqual(lines);
    expect(movePoDraftLine(lines, complete.key, blank.key, "bottom")).toEqual(lines);
  });

  it("does not require anchor normalization while typing in the entry row", () => {
    const entry = {
      ...createEmptyPoLine(),
      key: "entry-row",
      sku: "wid",
    };
    expect(poLinesNeedAnchorNormalization([entry], "bottom")).toBe(false);
    expect(poLinesNeedAnchorNormalization([entry], "top")).toBe(false);
  });

  it("requires anchor normalization when in-progress entry row is not on the anchor edge", () => {
    const complete = {
      ...createEmptyPoLine(),
      variant_id: "variant-a",
      quantity_ordered: "1",
    };
    const inProgress = {
      ...createEmptyPoLine(),
      key: "entry-row",
      sku: "wid",
    };
    expect(poLinesNeedAnchorNormalization([inProgress, complete], "bottom")).toBe(true);
  });

  it("filters incomplete trailing rows before save", () => {
    const complete = {
      ...createEmptyPoLine(),
      variant_id: "b162d4b9-0c3e-5d6f-9a2b-3c4d5e6f7a8b",
      quantity_ordered: "3",
    };
    const trailing = createEmptyPoLine();
    expect(filterSavablePoLines([complete, trailing])).toEqual([complete]);
  });
});

describe("supplier default currency", () => {
  const suppliers = [
    {
      id: "supplier-a",
      name: "Acme",
      payment_terms_days: 30,
      base_currency_override: "EUR",
    },
    {
      id: "supplier-b",
      name: "Beta",
      payment_terms_days: 15,
      base_currency_override: null,
    },
  ];

  it("uses supplier override when set", () => {
    expect(supplierDefaultCurrency(suppliers, "supplier-a", "INR")).toBe("EUR");
  });

  it("falls back to workspace currency when override is unset", () => {
    expect(supplierDefaultCurrency(suppliers, "supplier-b", "INR")).toBe("INR");
  });

  it("defaults new PO currency from the first supplier", () => {
    const draft = defaultPoDraftForm(
      [{ id: "loc-1", name: "Main", code: "MAIN" }],
      suppliers,
      "INR"
    );
    expect(draft.currency_code).toBe("EUR");
    expect(draft.supplier_id).toBe("supplier-a");
  });
});

describe("copyPoDraftFromOrder", () => {
  it("copies header and lines with fresh keys and clears requisition number", () => {
    const source = {
      id: "po-1",
      voucher_number: "PO-2026-0001",
      destination_location_id: "loc-1",
      destination_location_name: "Main",
      destination_location_code: "MAIN",
      supplier_id: "supplier-a",
      supplier_name: "Acme",
      supplier_address: null,
      destination_address: null,
      document_status: "ISSUED_ACTIVE" as const,
      currency_code: "EUR",
      payment_terms_days: 30,
      total_gross_amount: "100",
      total_tax_amount: "0",
      line_count: 1,
      total_net_amount: "100",
      shipping_amount: "0",
      shipping_tax_rate_pct: "0",
      shipping_tax_amount: "0",
      shipping_tax_type: "percent" as const,
      round_off_amount: "0",
      additional_charges_amount: "0",
      prices_tax_inclusive: false,
      tax_supply_nature: "INTERSTATE" as const,
      tax_mechanism: "FORWARD" as const,
      supplier_tax_treatment: null,
      supplier_country_code: null,
      incoterms_code: null,
      rcm_applicable: false,
      custom_fields: { requisition_number: "REQ-9", internal_notes: "Keep" },
      created_by: "u1",
      created_by_name: "Alex",
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
      lines: [
        {
          id: "line-db-id",
          item_id: "item-1",
          item_name: "Widget",
          variant_id: "var-1",
          variant_sku: "W-1",
          quantity_ordered: "2",
          quantity_received: "0",
          unit_price_contractual: "10",
          discount_percentage: "0",
          discount_amount: "0",
          line_tax_amount: "0",
          tax_rate_percentage: "0",
          tax_components: [],
          uom_code: "PCS",
          uom_conversion_factor: "1",
          line_total_gross: "20",
          open_quantity: "2",
        },
      ],
    };

    const draft = copyPoDraftFromOrder(source);
    expect(draft.supplier_id).toBe("supplier-a");
    expect(draft.custom_fields.requisition_number).toBe("");
    expect(draft.custom_fields.internal_notes).toBe("Keep");
    expect(draft.header_charges.shipping_amount).toBe("0");
    expect(draft.lines[0]?.key).not.toBe("line-db-id");
    expect(draft.lines[0]?.variant_id).toBe("var-1");
    expect(filterSavablePoLines(draft.lines)).toHaveLength(1);
  });

  it("remaps promo parent links to new draft keys when duplicating", () => {
    const source = {
      id: "po-1",
      voucher_number: "PO-2026-0002",
      destination_location_id: "loc-1",
      destination_location_name: "Main",
      destination_location_code: "MAIN",
      supplier_id: "supplier-a",
      supplier_name: "Acme",
      supplier_address: null,
      destination_address: null,
      document_status: "ISSUED_ACTIVE" as const,
      currency_code: "INR",
      payment_terms_days: 30,
      total_gross_amount: "100",
      total_tax_amount: "0",
      line_count: 2,
      total_net_amount: "100",
      shipping_amount: "0",
      shipping_tax_rate_pct: "0",
      shipping_tax_amount: "0",
      shipping_tax_type: "percent" as const,
      round_off_amount: "0",
      additional_charges_amount: "0",
      prices_tax_inclusive: false,
      tax_supply_nature: "INTERSTATE" as const,
      tax_mechanism: "FORWARD" as const,
      supplier_tax_treatment: null,
      supplier_country_code: null,
      incoterms_code: null,
      rcm_applicable: false,
      custom_fields: {},
      created_by: "u1",
      created_by_name: "Alex",
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
      lines: [
        {
          id: "paid-line-id",
          item_id: "item-paid",
          item_name: "Paid",
          variant_id: "var-paid",
          variant_sku: "P-1",
          quantity_ordered: "10",
          quantity_received: "0",
          unit_price_contractual: "100",
          discount_percentage: "0",
          discount_amount: "0",
          line_tax_amount: "0",
          tax_rate_percentage: "0",
          tax_components: [],
          uom_code: "PCS",
          uom_conversion_factor: "1",
          line_total_gross: "1000",
          open_quantity: "10",
          is_promotional: false,
        },
        {
          id: "promo-line-id",
          item_id: "item-promo",
          item_name: "Free",
          variant_id: "var-promo",
          variant_sku: "F-1",
          quantity_ordered: "2",
          quantity_received: "0",
          unit_price_contractual: "0",
          discount_percentage: "0",
          discount_amount: "0",
          line_tax_amount: "0",
          tax_rate_percentage: "0",
          tax_components: [],
          uom_code: "PCS",
          uom_conversion_factor: "1",
          line_total_gross: "0",
          open_quantity: "2",
          is_promotional: true,
          linked_parent_line_id: "paid-line-id",
          promo_group_id: "group-abc",
          promotional_category: "BUNDLE",
        },
      ],
    };

    const draft = copyPoDraftFromOrder(source);
    const paid = filterSavablePoLines(draft.lines).find((line) => line.variant_id === "var-paid");
    const promo = filterSavablePoLines(draft.lines).find((line) => line.variant_id === "var-promo");

    expect(paid?.key).toBeTruthy();
    expect(promo?.is_promotional).toBe(true);
    expect(promo?.linked_parent_line_key).toBe(paid?.key);
    expect(promo?.linked_parent_line_id).toBeNull();
    expect(promo?.promo_group_id).toBe("group-abc");
    expect(promo?.promotional_category).toBe("BUNDLE");
  });
});

describe("mapPurchaseOrderToDraft promo reload", () => {
  it("restores promo fields using persisted line ids as keys", () => {
    const line = mapSavedPoLineToDraftLine({
      id: "line-promo-id",
      item_id: "item-1",
      item_name: "Free",
      variant_id: "var-1",
      variant_sku: "F-1",
      quantity_ordered: "1",
      quantity_received: "0",
      unit_price_contractual: "0",
      discount_percentage: "0",
      discount_amount: "0",
      line_tax_amount: "0",
      tax_rate_percentage: "0",
      tax_components: [],
      uom_code: "PCS",
      uom_conversion_factor: "1",
      line_total_gross: "0",
      open_quantity: "1",
      is_promotional: true,
      linked_parent_line_id: "parent-line-id",
      promo_group_id: "group-1",
      promotional_category: "FOC",
    });

    expect(line.key).toBe("line-promo-id");
    expect(line.linked_parent_line_key).toBe("parent-line-id");
    expect(line.linked_parent_line_id).toBe("parent-line-id");
    expect(line.promotional_category).toBe("FOC");
  });

  it("maps full order lines for edit reload", () => {
    const draft = mapPurchaseOrderToDraft({
      id: "po-1",
      voucher_number: "PO-1",
      destination_location_id: "loc-1",
      destination_location_name: "Main",
      destination_location_code: "MAIN",
      supplier_id: "sup-1",
      supplier_name: "Vendor",
      supplier_address: null,
      destination_address: null,
      document_status: "DRAFT",
      currency_code: "INR",
      payment_terms_days: 0,
      total_gross_amount: "0",
      total_tax_amount: "0",
      line_count: 1,
      total_net_amount: "0",
      shipping_amount: "0",
      shipping_tax_rate_pct: "0",
      shipping_tax_amount: "0",
      shipping_tax_type: "percent",
      round_off_amount: "0",
      additional_charges_amount: "0",
      prices_tax_inclusive: false,
      tax_supply_nature: "INTERSTATE",
      tax_mechanism: "FORWARD",
      supplier_tax_treatment: null,
      supplier_country_code: null,
      incoterms_code: null,
      rcm_applicable: false,
      custom_fields: {},
      created_by: "u1",
      created_by_name: "Alex",
      created_at: "2026-06-01T00:00:00.000Z",
      updated_at: "2026-06-01T00:00:00.000Z",
      lines: [
        {
          id: "saved-line",
          item_id: "item-1",
          item_name: "Paid",
          variant_id: "var-paid",
          variant_sku: "P-1",
          quantity_ordered: "5",
          quantity_received: "0",
          unit_price_contractual: "10",
          discount_percentage: "0",
          discount_amount: "0",
          line_tax_amount: "0",
          tax_rate_percentage: "0",
          tax_components: [],
          uom_code: "PCS",
          uom_conversion_factor: "1",
          line_total_gross: "50",
          open_quantity: "5",
          is_promotional: false,
        },
      ],
    });

    const saved = filterSavablePoLines(draft.lines)[0];
    expect(saved?.key).toBe("saved-line");
    expect(saved?.is_promotional).toBe(false);
  });
});
