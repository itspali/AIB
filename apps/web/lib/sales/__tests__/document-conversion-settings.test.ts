import { describe, expect, it } from "vitest";
import {
  DEFAULT_SALES_DOCUMENT_CONVERSION_MODE,
  parseSalesDocumentConversionMode,
} from "@/lib/sales/document-conversion-settings";

describe("parseSalesDocumentConversionMode", () => {
  it("defaults to prefill_form", () => {
    expect(parseSalesDocumentConversionMode(undefined)).toBe("prefill_form");
    expect(parseSalesDocumentConversionMode("invalid")).toBe("prefill_form");
    expect(DEFAULT_SALES_DOCUMENT_CONVERSION_MODE).toBe("prefill_form");
  });

  it("accepts auto_convert", () => {
    expect(parseSalesDocumentConversionMode("auto_convert")).toBe("auto_convert");
  });
});
