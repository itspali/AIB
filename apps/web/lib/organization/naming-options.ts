export const NAMING_SEQUENCE_KEYS = [
  "PURCHASE_ORDER",
  "GOODS_RECEIPT_NOTE",
  "PURCHASE_INVOICE",
  "STOCK_TRANSFER",
  "SALES_QUOTATION",
  "SALES_ORDER",
  "SALES_INVOICE",
  "CUSTOMER_PAYMENT",
  "SALES_CREDIT_NOTE",
  "GENERAL_LEDGER",
] as const;

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
