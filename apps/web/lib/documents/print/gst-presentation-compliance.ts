import type { DocumentPresentationTemplate } from "@/lib/documents/print/types";

const GST_TAX_INVOICE_STATUTORY_NOTE =
  "This is a computer-generated tax invoice. E-invoice IRN will appear when integrated.";

export function applyGstPresentationOverrides(
  template: DocumentPresentationTemplate,
  gstRegistered: boolean
): DocumentPresentationTemplate {
  if (!gstRegistered || template.moduleKey !== "SALES_INVOICE") {
    return template;
  }

  const titleOverride =
    template.shellConfig.header.titleOverride?.trim() || "Tax Invoice";

  return {
    ...template,
    shellConfig: {
      ...template.shellConfig,
      header: {
        ...template.shellConfig.header,
        titleOverride,
      },
      compliance: {
        pack: "gst_tax_invoice",
        showPlaceOfSupply: true,
        showIrnPlaceholder: true,
        statutoryNote: GST_TAX_INVOICE_STATUTORY_NOTE,
      },
    },
  };
}
