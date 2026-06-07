import { describe, expect, it } from "vitest";
import {
  mergeProductPeekSection,
  resolvePeekFocusVariantIds,
  resolveSellableVariantCount,
} from "@/lib/products/peek-panels";
import type { ProductDetailSnapshot } from "@/lib/products/types";

describe("resolvePeekFocusVariantIds", () => {
  it("returns master and preferred variant ids with counts", () => {
    const result = resolvePeekFocusVariantIds(
      [
        { id: "m", is_master: true, is_sellable: false },
        { id: "a", is_sellable: true },
        { id: "b", is_sellable: true },
      ],
      "b"
    );

    expect(result.focusIds.sort()).toEqual(["b", "m"]);
    expect(result.counts).toEqual({ total: 3, sellable: 2 });
  });
});

describe("mergeProductPeekSection", () => {
  it("marks section loaded and clears variant count summary when variants arrive", () => {
    const detail = {
      id: "item-1",
      variants: [{ id: "m", is_master: true } as ProductDetailSnapshot["variants"][number]],
      variant_count_summary: { total: 3, sellable: 2 },
      peek_loaded_sections: [],
    } as ProductDetailSnapshot;

    const merged = mergeProductPeekSection(detail, "variants", {
      variants: [
        { id: "m", is_master: true } as ProductDetailSnapshot["variants"][number],
        { id: "a", is_master: false } as ProductDetailSnapshot["variants"][number],
      ],
    });

    expect(merged.peek_loaded_sections).toEqual(["variants"]);
    expect(merged.variant_count_summary).toBeUndefined();
    expect(merged.variants).toHaveLength(2);
  });
});

describe("resolveSellableVariantCount", () => {
  it("prefers variant_count_summary when present", () => {
    const detail = {
      variant_count_summary: { total: 5, sellable: 4 },
      variants: [],
    } as ProductDetailSnapshot;

    expect(resolveSellableVariantCount(detail)).toBe(4);
  });
});
