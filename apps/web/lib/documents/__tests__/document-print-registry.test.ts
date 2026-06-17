import { describe, expect, it } from "vitest";
import {
  DOCUMENT_PRINT_REGISTRY,
  getDocumentPrintAdapter,
} from "@/lib/documents/print/document-print-registry";

describe("document print registry", () => {
  it("registers all currently printable modules", () => {
    expect(Object.keys(DOCUMENT_PRINT_REGISTRY).sort()).toEqual([
      "GOODS_RECEIPT_NOTE",
      "PURCHASE_INVOICE",
      "PURCHASE_ORDER",
      "SALES_QUOTATION",
    ]);
  });

  it("returns null for unsupported modules", () => {
    expect(getDocumentPrintAdapter("SALES_ORDER")).toBeNull();
  });

  it("resolves purchase order adapter", () => {
    const adapter = getDocumentPrintAdapter("PURCHASE_ORDER");
    expect(adapter?.moduleKey).toBe("PURCHASE_ORDER");
    expect(adapter?.getTitle({ voucher_number: "PO-00001" } as never)).toBe("PO-00001");
  });
});
