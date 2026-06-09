import { describe, expect, it } from "vitest";
import {
  formatDocumentDecimal,
  normalizeDocumentDecimalInput,
  resolveColumnDecimalPlaces,
} from "@/lib/documents/decimal-format";
import type { DocumentColumnPref } from "@/lib/documents/types";
import { mergePoColumnPrefs } from "@/lib/documents/purchase-order-layout";

describe("decimal-format", () => {
  it("uses saved decimal places including zero", () => {
    const column: DocumentColumnPref = {
      id: "unit_price",
      label: "Unit price",
      defaultVisible: true,
      decimalPlaces: 0,
    };
    expect(resolveColumnDecimalPlaces(column)).toBe(0);
    expect(formatDocumentDecimal("12.567", 0)).toBe("13");
  });

  it("falls back to registry defaults by column id", () => {
    expect(
      resolveColumnDecimalPlaces({
        id: "quantity_ordered",
        label: "Qty",
        defaultVisible: true,
      })
    ).toBe(3);
  });

  it("normalizes draft input to fixed precision", () => {
    expect(normalizeDocumentDecimalInput("2.5", 3)).toBe("2.500");
    expect(normalizeDocumentDecimalInput("12.5678", 2)).toBe("12.57");
  });
});

describe("mergePoColumnPrefs decimalPlaces", () => {
  it("keeps registry defaults when saved column omits decimalPlaces", () => {
    const merged = mergePoColumnPrefs([
      {
        id: "quantity_ordered",
        label: "Qty",
        defaultVisible: true,
        group: "line",
        align: "right",
        lineSlot: "column",
      },
    ]);

    expect(merged.find((column) => column.id === "quantity_ordered")?.decimalPlaces).toBe(3);
  });

  it("applies saved decimalPlaces overrides", () => {
    const merged = mergePoColumnPrefs([
      {
        id: "unit_price",
        label: "Unit price",
        defaultVisible: true,
        group: "line",
        align: "right",
        lineSlot: "column",
        decimalPlaces: 4,
      },
    ]);

    expect(merged.find((column) => column.id === "unit_price")?.decimalPlaces).toBe(4);
  });
});
