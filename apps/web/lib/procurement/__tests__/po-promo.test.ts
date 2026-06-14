import { describe, expect, it } from "vitest";
import {
  assignPromoGroups,
  resolvePromoParentForSave,
} from "@/lib/procurement/purchase-orders/po-promo";
import type { PoDraftLine } from "@/lib/procurement/purchase-orders/draft-form";

function line(overrides: Partial<PoDraftLine> & Pick<PoDraftLine, "key">): PoDraftLine {
  return {
    sku: "",
    variant_id: overrides.variant_id ?? "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    item_id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
    item_name: "Item",
    variant_sku: "SKU-1",
    quantity_ordered: "1",
    unit_price_contractual: overrides.unit_price_contractual ?? "10",
    discount_percentage: "0",
    discount_amount: "0",
    skuError: null,
    ...overrides,
  };
}

describe("assignPromoGroups", () => {
  it("does not copy draft line keys into linked_parent_line_id", () => {
    const paidKey = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const promoKey = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    const result = assignPromoGroups([
      line({ key: paidKey, unit_price_contractual: "10" }),
      line({
        key: promoKey,
        unit_price_contractual: "0",
        is_promotional: true,
        linked_parent_line_key: paidKey,
        promotional_category: "FREE_GOODS",
      }),
    ]);

    const promo = result.find((row) => row.key === promoKey);
    expect(promo?.is_promotional).toBe(true);
    expect(promo?.linked_parent_line_id).toBeUndefined();
  });
});

describe("resolvePromoParentForSave", () => {
  it("uses linked_parent_variant_id for draft and persisted parents", () => {
    const parent = line({
      key: "new-draft-key-1111-1111-111111111111",
      variant_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
    });
    const promo = line({
      key: "promo-key",
      unit_price_contractual: "0",
      linked_parent_line_key: parent.key,
    });

    expect(resolvePromoParentForSave(promo, parent)).toEqual({
      linked_parent_variant_id: parent.variant_id,
    });
  });

  it("does not send stale persisted line ids as linked_parent_line_id", () => {
    const persistedId = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    const parent = line({ key: persistedId, variant_id: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee" });
    const promo = line({
      key: "promo-key",
      unit_price_contractual: "0",
      linked_parent_line_id: persistedId,
      linked_parent_line_key: persistedId,
    });

    expect(resolvePromoParentForSave(promo, parent)).toEqual({
      linked_parent_variant_id: parent.variant_id,
    });
  });
});
