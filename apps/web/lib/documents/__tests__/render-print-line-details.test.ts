import { describe, expect, it } from "vitest";
import { DOCUMENT_LAYOUT_MODULE_ADAPTERS } from "@/lib/documents/document-layout-module-adapters";
import { buildDocumentPrintModel } from "@/lib/documents/build-document-print-model";
import { getDesignerSampleDocument } from "@/lib/documents/print/designer-sample-documents";
import { renderPrintLineItemDetailsHtml } from "@/lib/documents/print/render-print-line-details";
import { renderDocumentHtml } from "@/lib/documents/print/render-document-html";
import {
  DEFAULT_PRESENTATION_SHELL_CONFIG,
  DEFAULT_PRESENTATION_STYLE_CONFIG,
} from "@/lib/documents/print/default-shell-config";
import type { DocumentOrgRenderContext, DocumentPresentationTemplate } from "@/lib/documents/print/types";
import { patchSalesLayoutColumn } from "@/lib/sales/shared/sales-commerce-layout";
import { buildCatalogFieldId } from "@/lib/documents/catalog-field-ids";

function salesOrderLayoutWithPrintExtras() {
  let layout = patchSalesLayoutColumn(
    DOCUMENT_LAYOUT_MODULE_ADAPTERS.SALES_ORDER.defaultLayout,
    "sku",
    { defaultVisible: true, lineSlot: "item_detail", itemDetailFlow: "new_line" }
  );
  layout = patchSalesLayoutColumn(layout, buildCatalogFieldId("item_column", "hsn_sac_code"), {
    defaultVisible: true,
    lineSlot: "item_detail",
    itemDetailFlow: "new_line",
  });
  return layout;
}

describe("renderPrintLineItemDetailsHtml", () => {
  it("renders grouped inline and new-line detail rows", () => {
    const html = renderPrintLineItemDetailsHtml(
      [
        { id: "sku", label: "SKU", defaultVisible: true, itemDetailFlow: "new_line" },
        { id: "unit", label: "Unit", defaultVisible: true, itemDetailFlow: "inline_previous" },
      ],
      { sku: "FDS-75-50", unit: "Pcs" }
    );

    expect(html).toContain('class="line-detail"');
    expect(html).toContain("SKU:");
    expect(html).toContain("FDS-75-50");
    expect(html).toContain("Unit:");
    expect(html).toContain("Pcs");
    expect(html).toContain("line-detail__row--inline");
  });

  it("omits empty detail values", () => {
    const html = renderPrintLineItemDetailsHtml(
      [{ id: "sku", label: "SKU", defaultVisible: true }],
      { sku: "—" }
    );

    expect(html).toBe("");
  });
});

describe("buildDocumentPrintModel line detail columns", () => {
  it("splits sales order table columns from item detail fields", () => {
    const layout = salesOrderLayoutWithPrintExtras();
    const sample = getDesignerSampleDocument("SALES_ORDER");
    const model = buildDocumentPrintModel("SALES_ORDER", layout, sample);

    expect(model.lineColumns.some((column) => column.id === "sku")).toBe(false);
    expect(model.itemDetailColumns?.some((column) => column.id === "sku")).toBe(true);
    expect(model.lines[0]?.sku).toBe("FDS-75-50");
  });
});

describe("renderDocumentHtml line detail rendering", () => {
  const presentation: DocumentPresentationTemplate = {
    templateKey: "test",
    moduleKey: "SALES_ORDER",
    viewContext: "PDF_PRINT",
    label: "Test",
    description: null,
    shellConfig: DEFAULT_PRESENTATION_SHELL_CONFIG,
    styleConfig: { ...DEFAULT_PRESENTATION_STYLE_CONFIG, layoutTheme: "modern" },
    isDefault: true,
    isActive: true,
    isCustomized: false,
  };

  const org: DocumentOrgRenderContext = {
    organizationName: "Sample Org",
    legalName: "Sample Org Pvt Ltd",
    tradeName: null,
    taxIdentifier: "29AAAAA0000A1Z5",
    addressLines: ["Bengaluru"],
    logoUrl: null,
    websiteUrl: null,
    locale: "en-IN",
  };

  it("embeds sku detail under the item cell", () => {
    const layout = salesOrderLayoutWithPrintExtras();
    const sample = getDesignerSampleDocument("SALES_ORDER");
    const model = buildDocumentPrintModel("SALES_ORDER", layout, sample);
    const html = renderDocumentHtml("SO-00001", model, presentation, org);

    expect(html).toContain('class="line-item-name"');
    expect(html).toContain('class="line-detail"');
    expect(html).toContain("FDS-75-50");
    expect(html).toContain("19059090");
    expect(html).not.toContain("<th>SKU</th>");
  });

  it("embeds unit under quantity when unit line field is hidden", () => {
    const layout = salesOrderLayoutWithPrintExtras();
    const sample = getDesignerSampleDocument("SALES_ORDER");
    const model = buildDocumentPrintModel("SALES_ORDER", layout, sample);

    expect(model.printLayoutHints?.showUnitUnderQty).toBe(true);

    const html = renderDocumentHtml("SO-00001", model, presentation, org);

    expect(html).toContain('class="line-qty-unit"');
    expect(html).toContain("Pcs");
  });
});
