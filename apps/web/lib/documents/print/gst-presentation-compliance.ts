import type { DocumentPresentationTemplate } from "@/lib/documents/print/types";

export const GST_TAX_INVOICE_STATUTORY_NOTE =
  "This is a computer-generated tax invoice. E-invoice IRN will appear when integrated.";

export function applyGstPresentationOverrides(
  template: DocumentPresentationTemplate,
  gstRegistered: boolean
): DocumentPresentationTemplate {
  if (!gstRegistered || template.moduleKey !== "SALES_INVOICE") {
    return template;
  }

  const existing = template.shellConfig.compliance;
  const compliance = {
    pack: "gst_tax_invoice" as const,
    showPlaceOfSupply: existing?.showPlaceOfSupply ?? true,
    showIrnPlaceholder: existing?.showIrnPlaceholder ?? true,
    statutoryNote: existing?.statutoryNote?.trim() || GST_TAX_INVOICE_STATUTORY_NOTE,
  };

  const titleOverride =
    template.shellConfig.header.titleOverride?.trim() ||
    (compliance.pack === "gst_tax_invoice" ? "Tax Invoice" : null);

  return {
    ...template,
    shellConfig: {
      ...template.shellConfig,
      header: {
        ...template.shellConfig.header,
        titleOverride,
      },
      compliance,
    },
  };
}

export function defaultGstComplianceConfig() {
  return {
    pack: "gst_tax_invoice" as const,
    showPlaceOfSupply: true,
    showIrnPlaceholder: true,
    statutoryNote: GST_TAX_INVOICE_STATUTORY_NOTE,
  };
}
