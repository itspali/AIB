import { describe, expect, it } from "vitest";
import {
  createEmptyPoLine,
  copyPoDraftFromOrder,
  defaultPoDraftForm,
  ensureLeadingPoLine,
  ensureTrailingPoLine,
  filterSavablePoLines,
  isPoLineComplete,
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
      line_count: 1,
      total_net_amount: "100",
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
          line_total_gross: "20",
          open_quantity: "2",
        },
      ],
    };

    const draft = copyPoDraftFromOrder(source);
    expect(draft.supplier_id).toBe("supplier-a");
    expect(draft.custom_fields.requisition_number).toBe("");
    expect(draft.custom_fields.internal_notes).toBe("Keep");
    expect(draft.lines[0]?.key).not.toBe("line-db-id");
    expect(draft.lines[0]?.variant_id).toBe("var-1");
    expect(filterSavablePoLines(draft.lines)).toHaveLength(1);
  });
});
