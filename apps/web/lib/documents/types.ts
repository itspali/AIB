export type DocumentViewContext = "SCREEN_GRID" | "PDF_PRINT" | "EMAIL_HTML";

export type DocumentModuleKey =
  | "PURCHASE_ORDER"
  | "GOODS_RECEIPT_NOTE"
  | "SALES_QUOTATION"
  | "SALES_ORDER"
  | "SALES_INVOICE";

export type DocumentTypography = {
  fontSize?: "xs" | "sm" | "base" | "lg";
  fontWeight?: "normal" | "semibold" | "bold";
  fontStyle?: "normal" | "italic";
};

export type DocumentColumnPref = {
  id: string;
  label: string;
  defaultVisible: boolean;
  showLabel?: boolean;
  group?: "line" | "header" | "totals" | "custom";
  align?: "left" | "right" | "center";
  typography?: DocumentTypography;
  /** Display decimal places for numeric fields (Phase 2 layout settings). */
  decimalPlaces?: number;
};

export type DocumentLayoutDefaults = {
  moduleKey: DocumentModuleKey;
  viewContext: DocumentViewContext;
  columns: DocumentColumnPref[];
};
