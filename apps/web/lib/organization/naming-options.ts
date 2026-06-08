export const NAMING_SEQUENCE_KEYS = [
  "PURCHASE_ORDER",
  "GOODS_RECEIPT_NOTE",
  "PURCHASE_INVOICE",
  "STOCK_TRANSFER",
  "STOCK_ADJUSTMENT",
  "SALES_QUOTATION",
  "SALES_ORDER",
  "SALES_INVOICE",
  "CUSTOMER_PAYMENT",
  "SALES_CREDIT_NOTE",
  "GENERAL_LEDGER",
] as const;

export type NamingSequenceKey = (typeof NAMING_SEQUENCE_KEYS)[number];

/** Short token used in default year-scoped voucher prefixes (e.g. PO-2026-). */
export const DOCUMENT_NAMING_PREFIX_TOKENS: Record<NamingSequenceKey, string> = {
  PURCHASE_ORDER: "PO",
  GOODS_RECEIPT_NOTE: "GRN",
  PURCHASE_INVOICE: "PI",
  STOCK_TRANSFER: "ST",
  STOCK_ADJUSTMENT: "SA",
  SALES_QUOTATION: "SQ",
  SALES_ORDER: "SO",
  SALES_INVOICE: "SI",
  CUSTOMER_PAYMENT: "CP",
  SALES_CREDIT_NOTE: "SCN",
  GENERAL_LEDGER: "GL",
};

export function defaultDocumentNamingPrefix(
  key: NamingSequenceKey,
  year: number = new Date().getFullYear()
): string {
  return `${DOCUMENT_NAMING_PREFIX_TOKENS[key]}-${year}-`;
}

export function defaultDocumentNamingSequences(
  keys: readonly NamingSequenceKey[] = NAMING_SEQUENCE_KEYS,
  year: number = new Date().getFullYear()
): Record<NamingSequenceKey, { prefix: string; digits: string; next: string }> {
  return Object.fromEntries(
    keys.map((key) => [
      key,
      { prefix: defaultDocumentNamingPrefix(key, year), digits: "5", next: "1" },
    ])
  ) as Record<NamingSequenceKey, { prefix: string; digits: string; next: string }>;
}

export const FACILITY_NAMING_SEQUENCE_KEYS = [
  "FACILITY_HQ",
  "FACILITY_STORE",
  "FACILITY_PLANT",
  "FACILITY_WH",
  "FACILITY_VIRTUAL",
  "FACILITY_NODE",
] as const;

export const DEFAULT_FACILITY_NAMING_SEQUENCES: Record<
  (typeof FACILITY_NAMING_SEQUENCE_KEYS)[number],
  { prefix: string; digits: string }
> = {
  FACILITY_HQ: { prefix: "HQ", digits: "2" },
  FACILITY_STORE: { prefix: "STORE", digits: "2" },
  FACILITY_PLANT: { prefix: "PLANT", digits: "2" },
  FACILITY_WH: { prefix: "WH", digits: "2" },
  FACILITY_VIRTUAL: { prefix: "VRTL", digits: "2" },
  FACILITY_NODE: { prefix: "NODE", digits: "2" },
};

export const VALUATION_METHOD_OPTIONS = ["FIFO", "MWAC"] as const;

export type ValuationMethodOption = (typeof VALUATION_METHOD_OPTIONS)[number];
