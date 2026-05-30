import { describe, expect, it } from "vitest";
import {
  defaultWrapModeForValueKind,
  textWrapModeClassName,
} from "@/lib/display/text-wrap";
import { resolveColumnWrapMode } from "@/lib/products/resolve-list-columns";
import { getDefaultProductListPrefs } from "@/lib/products/list-prefs";

describe("column wrap resolution", () => {
  it("uses user override from column prefs", () => {
    const prefs = getDefaultProductListPrefs();
    const slice = {
      ...prefs.columnPrefs.table.desktop,
      columnWrapModes: { description: "wrap" as const },
    };

    expect(resolveColumnWrapMode("description", slice, "table")).toBe("wrap");
  });

  it("defaults multiline columns to line-clamp-2 in table view", () => {
    const prefs = getDefaultProductListPrefs();
    expect(resolveColumnWrapMode("description", prefs.columnPrefs.table.desktop, "table")).toBe(
      "line-clamp-2"
    );
  });

  it("defaults text columns to truncate", () => {
    expect(defaultWrapModeForValueKind("text", "table")).toBe("truncate");
    expect(textWrapModeClassName("wrap", "multiline")).toContain("pre-wrap");
  });
});
