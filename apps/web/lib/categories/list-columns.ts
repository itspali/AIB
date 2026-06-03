import { columnWidths } from "@/lib/list-columns/sizing";
import type { ListColumnDef, ListColumnRegistry } from "@/lib/list-columns/types";

export const CATEGORY_LIST_COLUMN_IDS = [
  "name",
  "parent_name",
  "is_active",
  "item_count",
  "default_variant_strategy",
  "default_item_type",
  "attribute_count",
  "inherit_parent_attributes",
  "created_at",
  "updated_at",
] as const;

export type CategoryListColumnId = (typeof CATEGORY_LIST_COLUMN_IDS)[number];

export type CategoryListColumnDef = ListColumnDef<CategoryListColumnId>;

const W_NAME = columnWidths({
  default: { min: 140, max: 280 },
  mobile: { min: 120, max: 200 },
  desktop: { min: 160, max: 320 },
});

const W_TEXT = columnWidths({
  default: { min: 120, max: 220 },
  mobile: { min: 100, max: 180 },
  desktop: { min: 120, max: 260 },
});

const W_STATUS = columnWidths({
  default: { min: 96, max: 112 },
});

const W_NUMBER = columnWidths({
  default: { min: 72, max: 96 },
  desktop: { min: 80, max: 108 },
});

const W_BOOLEAN = columnWidths({
  default: { min: 88, max: 132 },
});

const W_DATE = columnWidths({
  default: { min: 100, max: 140 },
});

export const CATEGORY_LIST_COLUMNS: CategoryListColumnDef[] = [
  {
    id: "name",
    label: "Name",
    defaultVisible: true,
    group: "Identity",
    valueKind: "text",
    widths: W_NAME,
  },
  {
    id: "parent_name",
    label: "Parent",
    defaultVisible: true,
    group: "Identity",
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
    id: "item_count",
    label: "Items",
    defaultVisible: true,
    align: "right",
    group: "Inventory",
    valueKind: "number",
    widths: W_NUMBER,
  },
  {
    id: "default_variant_strategy",
    label: "Variant strategy",
    defaultVisible: false,
    group: "Defaults",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "default_item_type",
    label: "Item type",
    defaultVisible: false,
    group: "Defaults",
    valueKind: "text",
    widths: W_TEXT,
  },
  {
    id: "attribute_count",
    label: "Attributes",
    defaultVisible: false,
    align: "right",
    group: "Schema",
    valueKind: "number",
    widths: W_NUMBER,
  },
  {
    id: "inherit_parent_attributes",
    label: "Inherits parent",
    defaultVisible: false,
    align: "center",
    group: "Schema",
    widths: W_BOOLEAN,
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
    defaultVisible: false,
    group: "Timestamps",
    valueKind: "date",
    widths: W_DATE,
  },
];

export const CATEGORY_LIST_COLUMN_REGISTRY: ListColumnRegistry<CategoryListColumnId> = {
  ids: CATEGORY_LIST_COLUMN_IDS,
  columns: CATEGORY_LIST_COLUMNS,
  storageKey: "aib-category-list-prefs",
};

export function getCategoryColumnDef(id: CategoryListColumnId): CategoryListColumnDef {
  return CATEGORY_LIST_COLUMNS.find((column) => column.id === id)!;
}
