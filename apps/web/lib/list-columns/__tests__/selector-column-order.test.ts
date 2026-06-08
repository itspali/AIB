import { describe, expect, it } from "vitest";
import {
  ensureColumnInOrder,
  resolveSelectorColumnOrder,
} from "@/lib/list-columns/prefs";
import { resolveViewableColumnIds } from "@/lib/list-columns/types";
import { PRODUCT_LIST_COLUMN_REGISTRY } from "@/lib/products/list-columns";

describe("resolveSelectorColumnOrder", () => {
  it("includes every viewable column even when missing from saved order", () => {
    const viewable = ["name", "default_sku", "purchase_price"] as const;
    const saved = ["name", "default_sku"] as const;

    expect(resolveSelectorColumnOrder(viewable, saved)).toEqual([
      "name",
      "default_sku",
      "purchase_price",
    ]);
  });

  it("preserves saved order for viewable columns and drops restricted ones", () => {
    const viewable = ["name", "purchase_price", "default_sku"] as const;
    const saved = ["purchase_price", "restricted", "name", "default_sku"] as const;

    expect(resolveSelectorColumnOrder(viewable, saved)).toEqual([
      "purchase_price",
      "name",
      "default_sku",
    ]);
  });
});

describe("ensureColumnInOrder", () => {
  it("appends a column when it is not already present", () => {
    expect(ensureColumnInOrder(["name"], "purchase_price")).toEqual([
      "name",
      "purchase_price",
    ]);
  });
});

describe("resolveViewableColumnIds", () => {
  it("filters registry columns by permission key", () => {
    const allowed = new Set(["name", "purchase_price"]);
    const viewable = resolveViewableColumnIds(PRODUCT_LIST_COLUMN_REGISTRY, (key) =>
      allowed.has(key)
    );

    expect(viewable).toContain("name");
    expect(viewable).toContain("purchase_price");
    expect(viewable).not.toContain("selling_price");
  });
});
