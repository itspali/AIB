import { columnWidths } from "@/lib/list-columns/sizing";
import type { ListColumnDef, ListColumnRegistry } from "@/lib/list-columns/types";

export const PRODUCT_LIST_COLUMN_IDS = [
  "image",
  "name",
  "default_sku",
  "barcode",
  "classification",
  "category_name",
  "description",
  "base_unit_of_measure",
  "hsn_sac_code",
  "has_variants",
  "default_tax_category",
  "is_active",
  "is_purchasable",
  "is_salable",
  "is_returnable",
  "selling_price",
  "purchase_price",
  "supplier_name",
  "stock_on_hand",
  "created_at",
  "updated_at",
] as const;

export type ProductListColumnId = (typeof PRODUCT_LIST_COLUMN_IDS)[number];

export type ProductListColumnDef = ListColumnDef<ProductListColumnId>;

const W_IMAGE = columnWidths({
  default: { min: 48, max: 48, preferred: 48 },
});

const W_NAME = columnWidths({
  default: { min: 140, max: 240 },
  mobile: { min: 120, max: 180 },
  tablet: { min: 140, max: 220 },
  desktop: { min: 180, max: 320 },
});

const W_TEXT = columnWidths({
  default: { min: 120, max: 240 },
  mobile: { min: 100, max: 180 },
  tablet: { min: 110, max: 220 },
  desktop: { min: 120, max: 260 },
});

const W_MULTILINE = columnWidths({
  default: { min: 160, max: 280 },
  mobile: { min: 120, max: 200 },
  tablet: { min: 140, max: 240 },
  desktop: { min: 180, max: 300 },
});

const W_CODE = columnWidths({
  default: { min: 96, max: 160 },
  mobile: { min: 88, max: 140 },
  tablet: { min: 92, max: 150 },
  desktop: { min: 96, max: 168 },
});

const W_BOOLEAN = columnWidths({
  default: { min: 80, max: 96 },
});

const W_STATUS = columnWidths({
  default: { min: 96, max: 112 },
});

const W_NUMBER = columnWidths({
  default: { min: 88, max: 120 },
  desktop: { min: 96, max: 128 },
});

const W_DATE = columnWidths({
  default: { min: 100, max: 140 },
});

export const PRODUCT_LIST_COLUMNS: ProductListColumnDef[] = [
  {
    id: "image",
    label: "Image",
    defaultVisible: false,
    align: "center",
    group: "Identity",
    widths: W_IMAGE,
  },
  {
    id: "name",
    label: "Name",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_NAME,
    wrapWidthBoost: 32,
  },
  {
    id: "default_sku",
    label: "SKU",
    defaultVisible: true,
    group: "Identity",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "barcode",
    label: "Barcode",
    defaultVisible: false,
    group: "Identity",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "classification",
    label: "Classification",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "category_name",
    label: "Category",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "description",
    label: "Description",
    defaultVisible: false,
    group: "Identity",
    valueKind: "multiline",
    defaultWrapMode: "line-clamp-2",
    widths: W_MULTILINE,
    wrapWidthBoost: 40,
  },
  {
    id: "base_unit_of_measure",
    label: "Base UOM",
    defaultVisible: true,
    group: "Units & tax",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "hsn_sac_code",
    label: "HSN / SAC",
    defaultVisible: false,
    group: "Units & tax",
    valueKind: "code",
    widths: W_CODE,
  },
  {
    id: "has_variants",
    label: "Has variants",
    defaultVisible: false,
    align: "center",
    group: "Units & tax",
    widths: W_BOOLEAN,
  },
  {
    id: "default_tax_category",
    label: "Tax category",
    defaultVisible: false,
    group: "Units & tax",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "is_active",
    label: "Status",
    defaultVisible: true,
    align: "center",
    group: "Status",
    widths: W_STATUS,
  },
  {
    id: "is_purchasable",
    label: "Purchasable",
    defaultVisible: false,
    align: "center",
    group: "Status",
    widths: W_BOOLEAN,
  },
  {
    id: "is_salable",
    label: "Salable",
    defaultVisible: false,
    align: "center",
    group: "Status",
    widths: W_BOOLEAN,
  },
  {
    id: "is_returnable",
    label: "Returnable",
    defaultVisible: false,
    align: "center",
    group: "Status",
    widths: W_BOOLEAN,
  },
  {
    id: "selling_price",
    label: "Selling price",
    defaultVisible: false,
    align: "right",
    group: "Pricing",
    valueKind: "number",
    widths: W_NUMBER,
  },
  {
    id: "purchase_price",
    label: "Purchase price",
    defaultVisible: false,
    align: "right",
    group: "Pricing",
    valueKind: "number",
    widths: W_NUMBER,
  },
  {
    id: "supplier_name",
    label: "Supplier",
    defaultVisible: false,
    group: "Pricing",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "stock_on_hand",
    label: "Stock on hand",
    defaultVisible: true,
    align: "right",
    group: "Inventory",
    valueKind: "number",
    widths: W_NUMBER,
  },
  {
    id: "created_at",
    label: "Created",
    defaultVisible: false,
    group: "Timestamps",
    valueKind: "date",
    widths: W_DATE,
  },
  {
    id: "updated_at",
    label: "Updated",
    defaultVisible: true,
    group: "Timestamps",
    valueKind: "date",
    widths: W_DATE,
  },
];

export const PRODUCT_LIST_COLUMN_REGISTRY: ListColumnRegistry<ProductListColumnId> = {
  ids: PRODUCT_LIST_COLUMN_IDS,
  columns: PRODUCT_LIST_COLUMNS,
  storageKey: "aib-product-list-prefs",
};

export function getDefaultColumnOrder(): ProductListColumnId[] {
  return PRODUCT_LIST_COLUMNS.map((column) => column.id);
}

export function getDefaultVisibleColumns(): ProductListColumnId[] {
  return PRODUCT_LIST_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.id);
}

export function getColumnDef(id: ProductListColumnId): ProductListColumnDef {
  return PRODUCT_LIST_COLUMNS.find((column) => column.id === id)!;
}
