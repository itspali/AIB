import { describe, expect, it } from "vitest";
import { documentLayoutFromRow } from "@/lib/documents/document-layout-persistence";
import { normalizeDocumentLayoutTemplate } from "@/lib/documents/normalize-document-layout";
import {
  DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT,
  getSalesLineEntryTableColumns,
  normalizeSalesCommerceLayoutTemplate,
} from "@/lib/sales/shared/sales-commerce-layout";
import {
  shouldEmbedSalesTaxRateUnderLineTaxFromGrid,
  shouldShowSalesTaxRateUnderLineTaxColumn,
} from "@/lib/sales/shared/sales-line-display";

describe("sales line tax layout integration", () => {
  it("loads quotation defaults through sales layout normalizer (not PO)", () => {
    const fromRow = documentLayoutFromRow(null, "SALES_QUOTATION", "SCREEN_GRID");

    expect(fromRow.moduleKey).toBe("SALES_QUOTATION");
    expect(fromRow.columns.some((column) => column.id === "customer")).toBe(true);
    expect(fromRow.columns.some((column) => column.id === "supplier")).toBe(false);
  });

  it("shows tax subline after server + client normalize (no DB row)", () => {
    const fromRow = documentLayoutFromRow(null, "SALES_QUOTATION", "SCREEN_GRID");
    const clientLayout = normalizeSalesCommerceLayoutTemplate(fromRow);
    const gridIds = getSalesLineEntryTableColumns(clientLayout, {
      allowLineItemDiscounts: true,
    }).map((column) => column.id);

    expect(gridIds).toContain("line_tax_amount");
    expect(gridIds).not.toContain("tax_rate_pct");
    expect(shouldShowSalesTaxRateUnderLineTaxColumn(clientLayout)).toBe(true);
  });

  it("embeds tax rate from the rendered grid column list", () => {
    const grid = getSalesLineEntryTableColumns(DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT);
    expect(shouldEmbedSalesTaxRateUnderLineTaxFromGrid(grid)).toBe(true);
  });

  it("hides tax subline when Tax % is its own grid column (tenant layout)", () => {
    const tenantCols = DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT.columns.map((column) => {
      if (column.id === "line_tax_amount") {
        return { ...column, label: "Line tax", defaultVisible: true, lineSlot: "column" as const };
      }
      if (column.id === "tax_rate_pct") {
        return { ...column, defaultVisible: true, lineSlot: "column" as const };
      }
      if (column.id === "line_total") {
        return { ...column, defaultVisible: false };
      }
      return column;
    });

    const fromRow = documentLayoutFromRow(
      {
        module_key: "SALES_QUOTATION",
        view_context: "SCREEN_GRID",
        image_display_mode: "HIDDEN",
        grid_columns_json: tenantCols,
        line_item_formatting: {
          version: 1,
          lineColumnOrder: DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT.lineColumnOrder,
          catalogLineFieldOrder: [],
          headerFieldOrder: DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT.headerFieldOrder,
          totalsFieldOrder: DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT.totalsFieldOrder,
        },
      },
      "SALES_QUOTATION",
      "SCREEN_GRID"
    );
    const clientLayout = normalizeSalesCommerceLayoutTemplate(fromRow);
    const grid = getSalesLineEntryTableColumns(clientLayout);

    expect(shouldEmbedSalesTaxRateUnderLineTaxFromGrid(grid)).toBe(false);
  });

  it("shows tax subline when Tax % is only in item detail after full normalize chain", () => {
    const tenantCols = DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT.columns.map((column) => {
      if (column.id === "line_tax_amount") {
        return { ...column, label: "Line tax", defaultVisible: true, lineSlot: "column" as const };
      }
      if (column.id === "tax_rate_pct") {
        return { ...column, defaultVisible: true, lineSlot: "item_detail" as const };
      }
      return column;
    });

    const fromRow = documentLayoutFromRow(
      {
        module_key: "SALES_QUOTATION",
        view_context: "SCREEN_GRID",
        image_display_mode: "HIDDEN",
        grid_columns_json: tenantCols,
        line_item_formatting: {
          version: 1,
          lineColumnOrder: DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT.lineColumnOrder,
          catalogLineFieldOrder: [],
          headerFieldOrder: DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT.headerFieldOrder,
          totalsFieldOrder: DEFAULT_SALES_QUOTATION_SCREEN_LAYOUT.totalsFieldOrder,
        },
      },
      "SALES_QUOTATION",
      "SCREEN_GRID"
    );
    const clientLayout = normalizeSalesCommerceLayoutTemplate(fromRow);

    expect(shouldShowSalesTaxRateUnderLineTaxColumn(clientLayout)).toBe(true);
  });
});

describe("normalizeDocumentLayoutTemplate sales modules", () => {
  it("routes SALES_QUOTATION to sales layout defaults", () => {
    const layout = normalizeDocumentLayoutTemplate("SALES_QUOTATION", {
      moduleKey: "SALES_QUOTATION",
      viewContext: "SCREEN_GRID",
    });

    expect(layout.moduleKey).toBe("SALES_QUOTATION");
    expect(layout.columns.find((column) => column.id === "line_tax_amount")?.defaultVisible).toBe(
      true
    );
  });
});
