import { describe, expect, it } from "vitest";
import { getEffectiveChipDisplay, isChipModeEnabled } from "@/lib/list-columns/chip-colors";
import { getColumnDef } from "@/lib/products/list-columns";
import { getDefaultProductListPrefs } from "@/lib/products/list-prefs";

describe("product list chip display prefs", () => {
  it("defaults chip-eligible columns to chip mode", () => {
    const prefs = getDefaultProductListPrefs();
    const slice = prefs.columnPrefs.table.desktop;
    const column = getColumnDef("is_active");

    expect(isChipModeEnabled(column, slice)).toBe(true);
    expect(isChipModeEnabled(getColumnDef("name"), slice)).toBe(false);
  });

  it("enables chip mode per column in prefs slice", () => {
    const prefs = getDefaultProductListPrefs();
    const slice = {
      ...prefs.columnPrefs.table.desktop,
      columnChipDisplay: {
        is_active: { mode: "chip" as const },
        classification: { mode: "chip" as const },
      },
    };

    expect(isChipModeEnabled(getColumnDef("is_active"), slice)).toBe(true);
    expect(isChipModeEnabled(getColumnDef("name"), slice)).toBe(false);
  });

  it("respects explicit text mode opt-out", () => {
    const prefs = getDefaultProductListPrefs();
    const slice = {
      ...prefs.columnPrefs.table.desktop,
      columnChipDisplay: {
        is_active: { mode: "text" as const },
      },
    };

    expect(isChipModeEnabled(getColumnDef("is_active"), slice)).toBe(false);
  });

  it("applies default active/inactive colors for status column", () => {
    const column = getColumnDef("is_active");
    const effective = getEffectiveChipDisplay(column, { mode: "chip" });
    expect(effective.valueColors?.true?.preset).toBe("emerald");
    expect(effective.valueColors?.false?.preset).toBe("red");
  });

  it("marks status column as chip-eligible in registry", () => {
    expect(getColumnDef("name").chipEligible ?? false).toBe(false);
    expect(getColumnDef("is_active").chipEligible).toBe(true);
  });
});
