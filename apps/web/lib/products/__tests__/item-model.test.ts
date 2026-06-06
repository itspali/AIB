import { describe, expect, it } from "vitest";
import { parseItemBoolean, resolveItemTrackInventory } from "@/lib/products/item-model";

describe("parseItemBoolean", () => {
  it("coerces string and numeric truthy values", () => {
    expect(parseItemBoolean(true)).toBe(true);
    expect(parseItemBoolean("true")).toBe(true);
    expect(parseItemBoolean("t")).toBe(true);
    expect(parseItemBoolean(1)).toBe(true);
    expect(parseItemBoolean("1")).toBe(true);
  });

  it("coerces falsy values and uses fallback when unknown", () => {
    expect(parseItemBoolean(false)).toBe(false);
    expect(parseItemBoolean("false")).toBe(false);
    expect(parseItemBoolean(0)).toBe(false);
    expect(parseItemBoolean(null, true)).toBe(true);
    expect(parseItemBoolean(undefined, false)).toBe(false);
  });
});

describe("resolveItemTrackInventory", () => {
  it("returns false for non-physical and bundle items", () => {
    expect(
      resolveItemTrackInventory({ item_type: "SERVICE", track_inventory: true })
    ).toBe(false);
    expect(
      resolveItemTrackInventory({
        item_type: "PHYSICAL",
        track_inventory: true,
        is_bundle: true,
      })
    ).toBe(false);
  });

  it("honours physical item track flag with coercion", () => {
    expect(
      resolveItemTrackInventory({ item_type: "PHYSICAL", track_inventory: "true" as unknown as boolean })
    ).toBe(true);
    expect(
      resolveItemTrackInventory({ item_type: "PHYSICAL", track_inventory: false })
    ).toBe(false);
    expect(
      resolveItemTrackInventory({ item_type: "PHYSICAL", track_inventory: null as unknown as boolean })
    ).toBe(true);
  });
});
