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

export const PRODUCT_LIST_COLUMNS: ProductListColumnDef[] = [
  { id: "image", label: "Image", defaultVisible: false, align: "center", group: "Identity" },
  { id: "name", label: "Name", defaultVisible: true, group: "Identity" },
  { id: "default_sku", label: "SKU", defaultVisible: true, group: "Identity" },
  { id: "barcode", label: "Barcode", defaultVisible: false, group: "Identity" },
  { id: "classification", label: "Classification", defaultVisible: true, group: "Identity" },
  { id: "category_name", label: "Category", defaultVisible: true, group: "Identity" },
  { id: "description", label: "Description", defaultVisible: false, group: "Identity" },
  { id: "base_unit_of_measure", label: "Base UOM", defaultVisible: true, group: "Units & tax" },
  { id: "hsn_sac_code", label: "HSN / SAC", defaultVisible: false, group: "Units & tax" },
  {
    id: "has_variants",
    label: "Has variants",
    defaultVisible: false,
    align: "center",
    group: "Units & tax",
  },
  {
    id: "default_tax_category",
    label: "Tax category",
    defaultVisible: false,
    group: "Units & tax",
  },
  { id: "is_active", label: "Active", defaultVisible: true, align: "center", group: "Status" },
  {
    id: "is_purchasable",
    label: "Purchasable",
    defaultVisible: false,
    align: "center",
    group: "Status",
  },
  { id: "is_salable", label: "Salable", defaultVisible: false, align: "center", group: "Status" },
  {
    id: "is_returnable",
    label: "Returnable",
    defaultVisible: false,
    align: "center",
    group: "Status",
  },
  { id: "selling_price", label: "Selling price", defaultVisible: false, align: "right", group: "Pricing" },
  { id: "purchase_price", label: "Purchase price", defaultVisible: false, align: "right", group: "Pricing" },
  { id: "supplier_name", label: "Supplier", defaultVisible: false, group: "Pricing" },
  {
    id: "stock_on_hand",
    label: "Stock on hand",
    defaultVisible: true,
    align: "right",
    group: "Inventory",
  },
  { id: "created_at", label: "Created", defaultVisible: false, group: "Timestamps" },
  { id: "updated_at", label: "Updated", defaultVisible: true, group: "Timestamps" },
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
