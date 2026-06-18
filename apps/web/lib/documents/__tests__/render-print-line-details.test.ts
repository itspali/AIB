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
import { patchDocumentTypography } from "@/lib/documents/document-typography-classes";
import { patchPoLayoutColumn } from "@/lib/documents/purchase-order-layout";

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

  it("shows module document title and voucher number separately", () => {
    const layout = DOCUMENT_LAYOUT_MODULE_ADAPTERS.PURCHASE_ORDER.defaultLayout;
    const sample = getDesignerSampleDocument("PURCHASE_ORDER");
    const model = buildDocumentPrintModel("PURCHASE_ORDER", layout, sample);
    const poPresentation: DocumentPresentationTemplate = {
      templateKey: "test",
      moduleKey: "PURCHASE_ORDER",
      viewContext: "PDF_PRINT",
      label: "Test",
      description: null,
      shellConfig: DEFAULT_PRESENTATION_SHELL_CONFIG,
      styleConfig: DEFAULT_PRESENTATION_STYLE_CONFIG,
      isDefault: true,
      isActive: true,
      isCustomized: false,
    };
    const html = renderDocumentHtml("PO-00001", model, poPresentation, org);

    expect(html).toContain('<h1 class="doc-title">Purchase order</h1>');
    expect(html).toContain('<div class="doc-number">PO-00001</div>');
  });

  it("applies header field typography in the preview html", () => {
    const layout = patchPoLayoutColumn(
      DOCUMENT_LAYOUT_MODULE_ADAPTERS.PURCHASE_ORDER.defaultLayout,
      "voucher_number",
      { labelTypography: patchDocumentTypography(undefined, "fontWeight", "bold") }
    );
    const sample = getDesignerSampleDocument("PURCHASE_ORDER");
    const model = buildDocumentPrintModel("PURCHASE_ORDER", layout, sample);
    const poPresentation: DocumentPresentationTemplate = {
      ...presentation,
      moduleKey: "PURCHASE_ORDER",
      styleConfig: { ...DEFAULT_PRESENTATION_STYLE_CONFIG, layoutTheme: "compact" },
    };
    const html = renderDocumentHtml("PO-00001", model, poPresentation, org);
    const poField = model.headerFields.find((field) => field.id === "voucher_number");

    expect(poField?.labelTypography?.fontWeight).toBe("bold");
    expect(html).toContain('style="font-weight:700"');
    expect(html).toContain("PO-00001");
  });
});

describe("renderDocumentHtml letterhead logo", () => {
  const org: DocumentOrgRenderContext = {
    organizationName: "Acme Corp",
    legalName: "Acme Corp Pvt Ltd",
    tradeName: null,
    taxIdentifier: "29ABCDE1234F1Z5",
    addressLines: ["123 Main Street", "Bengaluru"],
    logoUrl: "https://example.com/logo.png",
    websiteUrl: "https://acme.example",
    locale: "en-IN",
  };

  it("renders logo above organization details by default", () => {
    const presentation: DocumentPresentationTemplate = {
      templateKey: "test",
      moduleKey: "PURCHASE_ORDER",
      viewContext: "PDF_PRINT",
      label: "Test",
      description: null,
      shellConfig: DEFAULT_PRESENTATION_SHELL_CONFIG,
      styleConfig: DEFAULT_PRESENTATION_STYLE_CONFIG,
      isDefault: true,
      isActive: true,
      isCustomized: false,
    };
    const layout = DOCUMENT_LAYOUT_MODULE_ADAPTERS.PURCHASE_ORDER.defaultLayout;
    const model = buildDocumentPrintModel(
      "PURCHASE_ORDER",
      layout,
      getDesignerSampleDocument("PURCHASE_ORDER")
    );

    const html = renderDocumentHtml("PO-00001", model, presentation, org);

    expect(html).toContain('class="letterhead letterhead--top"');
    expect(html).toContain('max-height:48px;max-width:180px');
  });

  it("renders logo left of organization when configured", () => {
    const presentation: DocumentPresentationTemplate = {
      templateKey: "test",
      moduleKey: "PURCHASE_ORDER",
      viewContext: "PDF_PRINT",
      label: "Test",
      description: null,
      shellConfig: {
        ...DEFAULT_PRESENTATION_SHELL_CONFIG,
        header: {
          ...DEFAULT_PRESENTATION_SHELL_CONFIG.header,
          logoPlacement: "left",
          logoMaxHeightPx: 64,
          logoMaxWidthPx: 200,
        },
      },
      styleConfig: DEFAULT_PRESENTATION_STYLE_CONFIG,
      isDefault: true,
      isActive: true,
      isCustomized: false,
    };
    const layout = DOCUMENT_LAYOUT_MODULE_ADAPTERS.PURCHASE_ORDER.defaultLayout;
    const model = buildDocumentPrintModel(
      "PURCHASE_ORDER",
      layout,
      getDesignerSampleDocument("PURCHASE_ORDER")
    );

    const html = renderDocumentHtml("PO-00001", model, presentation, org);

    expect(html).toContain('class="letterhead letterhead--left"');
    expect(html).toContain('class="brand-org"');
    expect(html).toContain('max-height:64px;max-width:200px');
  });
});
