export type DocumentViewContext = "SCREEN_GRID" | "PDF_PRINT" | "EMAIL_HTML";

export type DocumentModuleKey =
  | "PURCHASE_ORDER"
  | "GOODS_RECEIPT_NOTE"
  | "PURCHASE_INVOICE"
  | "SALES_QUOTATION"
  | "SALES_ORDER"
  | "SALES_INVOICE";

export type DocumentTypography = {
  fontSize?: "xs" | "sm" | "base" | "lg";
  fontWeight?: "normal" | "semibold" | "bold";
  fontStyle?: "normal" | "italic";
};

/** Line field placement in the compact drawer grid. */
export type DocumentLineSlot = "column" | "item_detail";

/** Header field placement on the PO create/edit form. */
export type DocumentHeaderSlot = "primary" | "details";

/** How item-detail fields flow under the item cell. */
export type DocumentItemDetailFlow = "new_line" | "inline_previous";

export type DocumentCatalogFieldSource =
  | "item_column"
  | "item_custom_field"
  | "variant_attribute"
  | "variant_attributes_all";

export type DocumentColumnPref = {
  id: string;
  label: string;
  defaultVisible: boolean;
  showLabel?: boolean;
  group?: "line" | "header" | "totals" | "catalog";
  align?: "left" | "right" | "center";
  /** @deprecated Migrated to labelTypography/valueTypography on read. */
  typography?: DocumentTypography;
  labelTypography?: DocumentTypography;
  valueTypography?: DocumentTypography;
  /** Display decimal places for numeric fields (Phase 2 layout settings). */
  decimalPlaces?: number;
  /** Header fields: top row vs details rail / stacked panel (create/edit form). */
  headerSlot?: DocumentHeaderSlot;
  /** Line fields: table column vs stacked under the item cell (drawer compact mode). */
  lineSlot?: DocumentLineSlot;
  /** When lineSlot is item_detail — own row vs inline with previous detail field. */
  itemDetailFlow?: DocumentItemDetailFlow;
  /** Catalog-backed line field — resolved from item/variant at render time. */
  catalogSource?: DocumentCatalogFieldSource;
  catalogSourceKey?: string;
};

export type DocumentImageDisplayMode = "INLINE_CELL" | "SEPARATE_COLUMN" | "HIDDEN";

export type DocumentLayoutDefaults = {
  moduleKey: DocumentModuleKey;
  viewContext: DocumentViewContext;
  columns: DocumentColumnPref[];
};

/** Full tenant layout template (settings UI + DB shape). */
export type DocumentLayoutTemplate = DocumentLayoutDefaults & {
  lineColumnOrder: string[];
  /** Item/variant catalog fields shown on PO lines (read-only). */
  catalogLineFieldOrder: string[];
  headerFieldOrder: string[];
  totalsFieldOrder: string[];
  imageDisplayMode: DocumentImageDisplayMode;
};

/** When true, Print and Email view tabs are editable in module layout settings. */
export const DOCUMENT_LAYOUT_PRINT_EMAIL_ENABLED = true;
