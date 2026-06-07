import { describe, expect, it } from "vitest";
import {
  getDefaultColorRulesForColumn,
  getEffectiveChipDisplay,
  isChipColorPreset,
  isValidCustomHex,
  normalizeColorRule,
  resolveChipColorRule,
  resolveValueColorRule,
} from "@/lib/list-columns/chip-colors";
import { CHIP_DEFAULT_FALLBACK_KEY } from "@/lib/list-columns/types";
import { PRODUCT_LIST_COLUMN_REGISTRY } from "@/lib/products/list-columns";
import { getColumnDef } from "@/lib/list-columns/types";

describe("chip-colors", () => {
  it("validates presets and hex colors", () => {
    expect(isChipColorPreset("emerald")).toBe(true);
    expect(isChipColorPreset("chartreuse")).toBe(false);
    expect(isValidCustomHex("#AABBCC")).toBe(true);
    expect(isValidCustomHex("AABBCC")).toBe(false);
  });

  it("normalizes color rules and strips invalid values", () => {
    expect(normalizeColorRule({ preset: "red", customHex: "#FF0000" })).toEqual({
      preset: "red",
      customHex: "#FF0000",
    });
    expect(normalizeColorRule({ preset: "bogus", customHex: "bad" })).toBeUndefined();
  });

  it("prefers custom hex over preset classes", () => {
    const resolved = resolveChipColorRule({ preset: "emerald", customHex: "#112233" });
    expect(resolved.className).toBeUndefined();
    expect(resolved.style?.color).toBe("#112233");
  });

  it("merges user chip colors over column defaults", () => {
    const column = getColumnDef(PRODUCT_LIST_COLUMN_REGISTRY, "is_active");
    const effective = getEffectiveChipDisplay(column, {
      mode: "chip",
      valueColors: { false: { preset: "amber" } },
    });
    expect(effective.mode).toBe("chip");
    expect(effective.valueColors?.true?.preset).toBe("emerald");
    expect(effective.valueColors?.false?.preset).toBe("amber");
  });

  it("falls back to neutral for unmapped values", () => {
    const column = getColumnDef(PRODUCT_LIST_COLUMN_REGISTRY, "category_name");
    const defaults = getDefaultColorRulesForColumn(column);
    const effective = getEffectiveChipDisplay(column, { mode: "chip" });
    const rule = resolveValueColorRule("Unknown Category", effective);
    expect(rule.preset ?? defaults[CHIP_DEFAULT_FALLBACK_KEY]?.preset).toBeTruthy();
  });
});
