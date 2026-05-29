export const PRODUCT_LIST_COLUMN_IDS = [
  "name",
  "default_sku",
  "classification",
  "category_name",
  "base_unit_of_measure",
  "is_active",
  "is_purchasable",
  "is_salable",
  "updated_at",
] as const;

export type ProductListColumnId = (typeof PRODUCT_LIST_COLUMN_IDS)[number];

export type ProductListColumnDef = {
  id: ProductListColumnId;
  label: string;
  defaultVisible: boolean;
  /** Table header alignment hint */
  align?: "left" | "right" | "center";
};

export const PRODUCT_LIST_COLUMNS: ProductListColumnDef[] = [
  { id: "name", label: "Name", defaultVisible: true },
  { id: "default_sku", label: "SKU", defaultVisible: true },
  { id: "classification", label: "Classification", defaultVisible: true },
  { id: "category_name", label: "Category", defaultVisible: true },
  { id: "base_unit_of_measure", label: "Base UOM", defaultVisible: true },
  { id: "is_active", label: "Active", defaultVisible: true, align: "center" },
  { id: "is_purchasable", label: "Purchasable", defaultVisible: false, align: "center" },
  { id: "is_salable", label: "Salable", defaultVisible: false, align: "center" },
  { id: "updated_at", label: "Updated", defaultVisible: true },
];

export function getDefaultColumnOrder(): ProductListColumnId[] {
  return PRODUCT_LIST_COLUMNS.map((column) => column.id);
}

export function getDefaultVisibleColumns(): ProductListColumnId[] {
  return PRODUCT_LIST_COLUMNS.filter((column) => column.defaultVisible).map((column) => column.id);
}

export function getColumnDef(id: ProductListColumnId): ProductListColumnDef {
  return PRODUCT_LIST_COLUMNS.find((column) => column.id === id)!;
}
