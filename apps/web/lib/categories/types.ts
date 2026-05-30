import type { AttributeFieldType } from "@/lib/categories/attribute-types";
import type { ItemType } from "@/lib/products/item-model";
import type { ProductVariantStrategy } from "@/lib/products/variant-strategy";

export type AttributeTemplateEntry = {
  key: string;
  label: string;
  type: AttributeFieldType;
  required?: boolean;
  options?: string[];
};

export type CategoryRow = {
  id: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  attribute_templates: AttributeTemplateEntry[];
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
  default_variant_strategy: ProductVariantStrategy;
};
