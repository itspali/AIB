import { describe, expect, it } from "vitest";
import { buildPrintLineCatalogContext } from "@/lib/documents/print/print-line-catalog-context";
import { createPoCatalogFieldPref } from "@/lib/documents/purchase-order-layout";
import { resolveCatalogLineFieldDisplay } from "@/lib/documents/catalog-line-values";

describe("buildPrintLineCatalogContext", () => {
  it("builds server catalog snapshot from item master joins", () => {
    const context = buildPrintLineCatalogContext({
      hsn_sac_code: "8471",
      description: "Widget assembly",
      base_unit_of_measure: "EA",
      variant_attributes: { Color: "Red" },
    });

    expect(context?.hsn_sac_code).toBe("8471");
    expect(
      resolveCatalogLineFieldDisplay(
        createPoCatalogFieldPref("item_column", "hsn_sac_code", "HSN/SAC"),
        context
      )
    ).toBe("8471");
  });

  it("returns existing catalog_context unchanged", () => {
    const existing = buildPrintLineCatalogContext({ hsn_sac_code: "1234" });
    expect(buildPrintLineCatalogContext({ catalog_context: existing, hsn_sac_code: "9999" })).toBe(
      existing
    );
  });
});
