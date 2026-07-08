import { describe, expect, it } from "vitest";
import {
  EXACT_DUPLICATE_ITEM_NAME_MESSAGE,
  itemNamesMatchTenantWide,
  normalizeItemNameForComparison,
} from "@/lib/products/item-name-uniqueness";

describe("itemNamesMatchTenantWide", () => {
  it("matches case-insensitively with trim", () => {
    expect(itemNamesMatchTenantWide("  Widget  ", "widget")).toBe(true);
    expect(itemNamesMatchTenantWide("Widget", "Gadget")).toBe(false);
  });

  it("rejects empty names", () => {
    expect(itemNamesMatchTenantWide("  ", "widget")).toBe(false);
    expect(normalizeItemNameForComparison("  ")).toBe("");
  });
});

describe("EXACT_DUPLICATE_ITEM_NAME_MESSAGE", () => {
  it("is stable copy for inline validation", () => {
    expect(EXACT_DUPLICATE_ITEM_NAME_MESSAGE).toContain("already exists");
  });
});
