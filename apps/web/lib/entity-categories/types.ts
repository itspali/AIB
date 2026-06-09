import type { AttributeTemplateEntry } from "@/lib/categories/types";

export type EntityCategoryWorkspace = "customer" | "supplier";

export type EntityCategoryRow = {
  id: string;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  attribute_templates: AttributeTemplateEntry[];
  /** When true (default), merge ancestor templates then own; child keys override. */
  inherit_parent_attributes: boolean;
  created_at: string;
  updated_at: string;
};

export type EntityCategoryTreeNode = EntityCategoryRow & {
  children: EntityCategoryTreeNode[];
  depth: number;
};

export type EntityCategoryFormValues = {
  category_id?: string | null;
  name: string;
  parent_id: string | null;
  is_active: boolean;
  attribute_templates: AttributeTemplateEntry[];
  inherit_parent_attributes: boolean;
};
