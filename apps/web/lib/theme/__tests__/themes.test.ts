import { describe, expect, it } from "vitest";
import {
  DEFAULT_THEME,
  normalizeStoredTheme,
  themeToHtmlClass,
  THEMES,
} from "@/lib/theme/themes";

describe("normalizeStoredTheme", () => {
  it("maps legacy light ids to glass light", () => {
    expect(normalizeStoredTheme("light")).toBe("light");
    expect(normalizeStoredTheme("light-cyan")).toBe("light");
    expect(normalizeStoredTheme("light-blue")).toBe("light");
    expect(normalizeStoredTheme("light-warm")).toBe("light");
  });

  it("returns known themes unchanged", () => {
    for (const theme of THEMES) {
      expect(normalizeStoredTheme(theme)).toBe(theme);
    }
  });

  it("falls back to default for unknown values", () => {
    expect(normalizeStoredTheme("system")).toBe(DEFAULT_THEME);
    expect(normalizeStoredTheme(null)).toBe(DEFAULT_THEME);
  });
});

describe("themeToHtmlClass", () => {
  it("maps each theme to its html class", () => {
    expect(themeToHtmlClass("dark")).toBe("dark");
    expect(themeToHtmlClass("light")).toBe("theme-light-glass");
  });
});
