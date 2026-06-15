import { describe, expect, it } from "vitest";
import { DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT } from "@/lib/sales/shared/sales-commerce-layout";
import { shouldShowSalesTaxRateUnderLineTaxColumn } from "@/lib/sales/shared/sales-line-display";

describe("sales line tax layout", () => {
  it("stacks tax rate under line tax on default quotation layout", () => {
    expect(shouldShowSalesTaxRateUnderLineTaxColumn(DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT)).toBe(
      true
    );
  });

  it("stacks tax rate under line tax when Tax % is only in item detail", () => {
    const layout = {
      ...DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT,
      columns: DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT.columns.map((column) => {
        if (column.id === "tax_rate_pct") {
          return { ...column, defaultVisible: true, lineSlot: "item_detail" as const };
        }
        return column;
      }),
    };

    expect(shouldShowSalesTaxRateUnderLineTaxColumn(layout)).toBe(true);
  });

  it("keeps tax rate in its own column when Tax % is a grid column", () => {
    const layout = {
      ...DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT,
      columns: DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT.columns.map((column) =>
        column.id === "tax_rate_pct" ? { ...column, defaultVisible: true, lineSlot: "column" as const } : column
      ),
    };

    expect(shouldShowSalesTaxRateUnderLineTaxColumn(layout)).toBe(false);
  });
});
