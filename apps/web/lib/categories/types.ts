export type AttributeTemplateEntry = {
  key: string;
  label: string;
  type: "text" | "number" | "date" | "boolean";
  required?: boolean;
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
  name: string;
  parent_id: string | null;
  is_active: boolean;
  attribute_templates: AttributeTemplateEntry[];
};
