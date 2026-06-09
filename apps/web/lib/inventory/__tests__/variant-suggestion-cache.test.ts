import { describe, expect, it } from "vitest";
import { filterStockVariantSuggestions } from "@/lib/inventory/stock/variant-suggestion-filter";
import type { StockVariantOption } from "@/lib/inventory/stock/types";

const SAMPLE: StockVariantOption[] = [
  {
    variant_id: "1",
    item_id: "a",
    item_name: "Alpha Widget",
    variant_sku: "AW-001",
    standard_cost: "10",
    adjustable: true,
    blocked_reason: null,
    image_url: null,
    base_unit_of_measure: null,
  },
  {
    variant_id: "2",
    item_id: "b",
    item_name: "Beta Bolt",
    variant_sku: "BB-100",
    standard_cost: "5",
    adjustable: true,
    blocked_reason: null,
    image_url: null,
    base_unit_of_measure: "KG",
  },
];

describe("filterStockVariantSuggestions", () => {
  it("returns all variants for empty query", () => {
    expect(filterStockVariantSuggestions(SAMPLE, "")).toEqual(SAMPLE);
  });

  it("filters by sku or item name", () => {
    expect(filterStockVariantSuggestions(SAMPLE, "bb").map((row) => row.variant_id)).toEqual(["2"]);
    expect(filterStockVariantSuggestions(SAMPLE, "alpha").map((row) => row.variant_id)).toEqual(["1"]);
  });
});
