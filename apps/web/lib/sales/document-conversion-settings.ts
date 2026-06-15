export const SALES_DOCUMENT_CONVERSION_MODES = ["prefill_form", "auto_convert"] as const;

export type SalesDocumentConversionMode = (typeof SALES_DOCUMENT_CONVERSION_MODES)[number];

export const DEFAULT_SALES_DOCUMENT_CONVERSION_MODE: SalesDocumentConversionMode = "prefill_form";

export function parseSalesDocumentConversionMode(
  value: unknown
): SalesDocumentConversionMode {
  return value === "auto_convert" ? "auto_convert" : "prefill_form";
}

export const SALES_DOCUMENT_CONVERSION_MODE_OPTIONS: ReadonlyArray<{
  value: SalesDocumentConversionMode;
  title: string;
  description: string;
}> = [
  {
    value: "prefill_form",
    title: "Open pre-filled form",
    description:
      "Open a new sales order or invoice with data copied from the source document. You review and save manually.",
  },
  {
    value: "auto_convert",
    title: "Auto-convert with confirmation",
    description:
      "After you confirm, the system creates the target document immediately and opens it.",
  },
];
