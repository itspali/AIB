import { describe, expect, it } from "vitest";
import { normalizeListColumnPrefs } from "@/lib/list-columns/prefs";
import { PRODUCT_LIST_COLUMN_REGISTRY } from "@/lib/products/list-columns";

describe("normalizeListColumnPrefs chip display", () => {
  it("keeps chip prefs only for chip-eligible columns", () => {
    const normalized = normalizeListColumnPrefs(PRODUCT_LIST_COLUMN_REGISTRY, {
      columnOrder: [...PRODUCT_LIST_COLUMN_REGISTRY.ids],
      visibleColumns: ["name", "is_active"],
      columnChipDisplay: {
        is_active: { mode: "chip", valueColors: { true: { preset: "sky" } } },
        name: { mode: "chip", valueColors: { foo: { preset: "red" } } },
      },
    });

    expect(normalized.columnChipDisplay?.is_active?.mode).toBe("chip");
    expect(normalized.columnChipDisplay?.is_active?.valueColors?.true?.preset).toBe("sky");
    expect(normalized.columnChipDisplay?.name).toBeUndefined();
  });

  it("strips invalid custom hex from value colors", () => {
    const normalized = normalizeListColumnPrefs(PRODUCT_LIST_COLUMN_REGISTRY, {
      columnOrder: [...PRODUCT_LIST_COLUMN_REGISTRY.ids],
      visibleColumns: ["is_active"],
      columnChipDisplay: {
        is_active: {
          mode: "chip",
          valueColors: { false: { preset: "red", customHex: "not-a-color" } },
        },
      },
    });

    expect(normalized.columnChipDisplay?.is_active?.valueColors?.false).toEqual({
      preset: "red",
    });
  });
});
