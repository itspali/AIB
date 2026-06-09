import { describe, expect, it } from "vitest";
import {
  createEmptyPoLine,
  defaultPoDraftForm,
  ensureTrailingPoLine,
  filterSavablePoLines,
  isPoLineComplete,
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
