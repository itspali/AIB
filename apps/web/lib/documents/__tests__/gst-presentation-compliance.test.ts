import { describe, expect, it } from "vitest";
import { applyGstPresentationOverrides } from "@/lib/documents/print/gst-presentation-compliance";
import { DEFAULT_PRESENTATION_SHELL_CONFIG } from "@/lib/documents/print/default-shell-config";
import type { DocumentPresentationTemplate } from "@/lib/documents/print/types";

function baseTemplate(moduleKey: DocumentPresentationTemplate["moduleKey"]): DocumentPresentationTemplate {
  return {
    templateKey: "test",
    moduleKey,
    viewContext: "PDF_PRINT",
    label: "Test",
    description: null,
    shellConfig: DEFAULT_PRESENTATION_SHELL_CONFIG,
    styleConfig: { fontFamily: "system-ui, sans-serif", fontSizePx: 12 },
    isDefault: true,
    isActive: true,
    isCustomized: false,
  };
}

describe("applyGstPresentationOverrides", () => {
  it("leaves non-invoice templates unchanged", () => {
    const template = baseTemplate("PURCHASE_ORDER");
    expect(applyGstPresentationOverrides(template, true)).toEqual(template);
  });

  it("leaves invoice templates unchanged when org is not GST registered", () => {
    const template = baseTemplate("SALES_INVOICE");
    expect(applyGstPresentationOverrides(template, false)).toEqual(template);
  });

  it("applies GST tax invoice pack for registered orgs", () => {
    const template = baseTemplate("SALES_INVOICE");
    const result = applyGstPresentationOverrides(template, true);
    expect(result.shellConfig.header.titleOverride).toBe("Tax Invoice");
    expect(result.shellConfig.compliance?.pack).toBe("gst_tax_invoice");
    expect(result.shellConfig.compliance?.showIrnPlaceholder).toBe(true);
  });
});
