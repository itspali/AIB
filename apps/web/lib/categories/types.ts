import type { AttributeFieldType } from "@/lib/categories/attribute-types";
import type { ItemType } from "@/lib/products/item-model";
import type { ProductVariantStrategy } from "@/lib/products/variant-strategy";

/** Whether a category attribute defines variants (axis) or just describes the item. */
export type AttributeRole = "axis" | "descriptive";

export type AttributeTemplateEntry = {
  key: string;
  label: string;
  type: AttributeFieldType;
  required?: boolean;
  options?: string[];
  /**
   * Default composition role suggested to items. "axis" means each value
   * creates a separate SKU; "descriptive" means it stays the same across SKUs.
   * Undefined falls back to a type-based heuristic.
   */
  role?: AttributeRole;
};

export type CategoryRow = {
  id: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  attribute_templates: AttributeTemplateEntry[];
  /** When true (default), merge ancestor templates then own; child keys override. */
  inherit_parent_attributes: boolean;
  default_variant_strategy: ProductVariantStrategy;
  default_item_type?: ItemType;
  created_at: string;
  updated_at: string;
};

export type CategoryTreeNode = CategoryRow & {
  children: CategoryTreeNode[];
  depth: number;
};

export type SystemCategoryFormValues = {
  category_id?: string | null;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  attribute_templates: AttributeTemplateEntry[];
  inherit_parent_attributes: boolean;
  default_variant_strategy: ProductVariantStrategy;
};
