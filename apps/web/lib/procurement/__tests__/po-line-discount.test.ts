import { describe, expect, it } from "vitest";
import { DEFAULT_PO_SCREEN_LAYOUT } from "@/lib/documents/purchase-order-layout";
import {
  formatPoLineComputedDiscountAmount,
  formatPoPeekComputedDiscountAmountDisplay,
  formatPoPeekDiscountEntryDisplay,
  normalizePoLineDiscountForSave,
  patchPoLineDiscountPercentInput,
  patchPoLineDiscountType,
  resolvePoLineDiscountInputValue,
  resolvePoLineDiscountType,
  shouldShowPoDiscountAmountUnderPctColumn,
  shouldShowPoDiscountTypeUnderPctColumn,
} from "@/lib/procurement/purchase-orders/po-line-discount";

describe("po-line-discount layout", () => {
  it("always stacks type under discount entry column", () => {
    expect(shouldShowPoDiscountTypeUnderPctColumn()).toBe(true);
  });

  it("stacks disc amount under Discount when Disc amount column is hidden", () => {
    const layout = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "discount_pct" ? { ...column, defaultVisible: true } : column
      ),
    };

    expect(shouldShowPoDiscountAmountUnderPctColumn(layout)).toBe(true);
  });

  it("keeps disc amount in its own column when Disc amount is visible", () => {
    const layout = {
      ...DEFAULT_PO_SCREEN_LAYOUT,
      columns: DEFAULT_PO_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "discount_amount" || column.id === "discount_pct"
          ? { ...column, defaultVisible: true }
          : column
      ),
    };

    expect(shouldShowPoDiscountAmountUnderPctColumn(layout)).toBe(false);
  });
});

describe("po-line-discount resolution", () => {
  it("uses explicit discount_type when set", () => {
    const line = {
      discount_percentage: "10",
      discount_amount: "25",
      discount_type: "percent" as const,
    };

    expect(resolvePoLineDiscountType(line)).toBe("percent");
    expect(resolvePoLineDiscountInputValue(line)).toBe("10");
  });

  it("prefers amount type when discount_amount is non-zero and type unset", () => {
    const line = {
      discount_percentage: "10",
      discount_amount: "25",
    };

    expect(resolvePoLineDiscountType(line)).toBe("amount");
    expect(resolvePoLineDiscountInputValue(line)).toBe("25");
  });

  it("clears fixed amount when entering percent discount", () => {
    expect(
      patchPoLineDiscountPercentInput(
        { discount_percentage: "0", discount_amount: "250" },
        "10"
      )
    ).toEqual({
      discount_type: "percent",
      discount_percentage: "10",
      discount_amount: "0",
    });
  });

  it("retains amount mode when switching type before entering a value", () => {
    expect(
      patchPoLineDiscountType(
        { discount_percentage: "10", discount_amount: "0" },
        "amount"
      )
    ).toEqual({
      discount_type: "amount",
      discount_percentage: "0",
      discount_amount: "0",
    });
    expect(
      resolvePoLineDiscountType({
        discount_type: "amount",
        discount_percentage: "0",
        discount_amount: "0",
      })
    ).toBe("amount");
  });

  it("normalizes save payload to a single active discount field", () => {
    expect(
      normalizePoLineDiscountForSave({
        discount_type: "percent",
        discount_percentage: "10",
        discount_amount: "99",
      })
    ).toEqual({ discount_percentage: "10", discount_amount: "0" });

    expect(
      normalizePoLineDiscountForSave({
        discount_type: "amount",
        discount_percentage: "50",
        discount_amount: "25",
      })
    ).toEqual({ discount_percentage: "0", discount_amount: "25" });
  });

  it("formats peek discount entry with percent suffix", () => {
    const percentColumn = DEFAULT_PO_SCREEN_LAYOUT.columns.find(
      (column) => column.id === "discount_pct"
    )!;

    expect(
      formatPoPeekDiscountEntryDisplay(
        { discount_percentage: "10", discount_amount: "0" },
        percentColumn
      )
    ).toBe("10.00%");
  });

  it("formats peek computed discount amount from saved line values", () => {
    const amountColumn = DEFAULT_PO_SCREEN_LAYOUT.columns.find(
      (column) => column.id === "discount_amount"
    )!;

    expect(
      formatPoPeekComputedDiscountAmountDisplay(
        {
          quantity_ordered: "12",
          unit_price_contractual: "1000",
          discount_percentage: "10",
          discount_amount: "0",
        },
        amountColumn
      )
    ).toBe("1,200.00");
  });

  it("formats draft computed discount amount for read-only column", () => {
    const amountColumn = DEFAULT_PO_SCREEN_LAYOUT.columns.find(
      (column) => column.id === "discount_amount"
    )!;

    expect(
      formatPoLineComputedDiscountAmount(
        {
          quantity_ordered: "12",
          unit_price_contractual: "1000",
          discount_type: "percent",
          discount_percentage: "10",
          discount_amount: "0",
        },
        amountColumn
      )
    ).toBe("1,200.00");
  });
});
