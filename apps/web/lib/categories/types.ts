import type { AttributeFieldType } from "@/lib/categories/attribute-types";

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
};
