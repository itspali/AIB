import { describe, expect, it } from "vitest";
import {
  buildDocumentPdfStoragePath,
  computeDocumentRenderFingerprint,
  readDocumentSourceUpdatedAt,
} from "@/lib/documents/print/document-pdf-cache";
import { DEFAULT_PRESENTATION_SHELL_CONFIG } from "@/lib/documents/print/default-shell-config";
import type { DocumentPresentationTemplate } from "@/lib/documents/print/types";
import { DEFAULT_SALES_ORDER_SCREEN_LAYOUT } from "@/lib/sales/shared/sales-commerce-layout";

function basePresentation(): DocumentPresentationTemplate {
  return {
    templateKey: "sales.invoice.standard",
    moduleKey: "SALES_INVOICE",
    viewContext: "PDF_PRINT",
    label: "Invoice",
    description: null,
    shellConfig: DEFAULT_PRESENTATION_SHELL_CONFIG,
    styleConfig: { fontFamily: "system-ui, sans-serif", fontSizePx: 12 },
    isDefault: true,
    isActive: true,
    isCustomized: false,
  };
}

describe("document pdf cache helpers", () => {
  it("builds tenant-scoped storage paths", () => {
    expect(
      buildDocumentPdfStoragePath({
        tenantId: "11111111-1111-1111-1111-111111111111",
        moduleKey: "SALES_INVOICE",
        documentId: "22222222-2222-2222-2222-222222222222",
        viewContext: "PDF_PRINT",
        locationId: null,
      })
    ).toBe(
      "11111111-1111-1111-1111-111111111111/SALES_INVOICE/22222222-2222-2222-2222-222222222222/PDF_PRINT/tenant.pdf"
    );
  });

  it("changes fingerprint when shell config changes", () => {
    const presentation = basePresentation();
    const layout = DEFAULT_SALES_ORDER_SCREEN_LAYOUT;
    const before = computeDocumentRenderFingerprint(presentation, layout);
    const after = computeDocumentRenderFingerprint(
      {
        ...presentation,
        shellConfig: {
          ...presentation.shellConfig,
          footer: { ...presentation.shellConfig.footer, legalText: "Registered office" },
        },
      },
      layout
    );
    expect(before).not.toBe(after);
  });

  it("reads document timestamps for cache invalidation", () => {
    expect(readDocumentSourceUpdatedAt({ updated_at: "2026-06-17T10:00:00.000Z" })).toBe(
      "2026-06-17T10:00:00.000Z"
    );
    expect(readDocumentSourceUpdatedAt({ received_at: "2026-06-16T08:00:00.000Z" })).toBe(
      "2026-06-16T08:00:00.000Z"
    );
    expect(readDocumentSourceUpdatedAt({})).toBe(new Date(0).toISOString());
  });
});
