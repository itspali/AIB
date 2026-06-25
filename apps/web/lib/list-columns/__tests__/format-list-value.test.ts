import { describe, expect, it } from "vitest";
import { formatListCurrency, formatListQuantity } from "@/lib/list-columns/format-list-value";

describe("formatListCurrency", () => {
  it("formats finite numbers as INR currency", () => {
    expect(formatListCurrency(1234.5)).toMatch(/1,234\.50/);
  });

  it("formats numeric strings", () => {
    expect(formatListCurrency("99")).toMatch(/99\.00/);
  });

  it("returns em dash for empty values", () => {
    expect(formatListCurrency(null)).toBe("—");
    expect(formatListCurrency("")).toBe("—");
  });
});

describe("formatListQuantity", () => {
  it("groups digits with en-IN locale", () => {
    expect(formatListQuantity(12345)).toBe("12,345");
  });

  it("preserves fractional quantities", () => {
    expect(formatListQuantity(12.5)).toBe("12.5");
  });

  it("returns em dash for empty values", () => {
    expect(formatListQuantity(undefined)).toBe("—");
  });
});
