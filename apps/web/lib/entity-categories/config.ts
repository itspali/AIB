import type { EntityCategoryWorkspace } from "@/lib/entity-categories/types";

export type EntityCategoryWorkspaceConfig = {
  workspace: EntityCategoryWorkspace;
  table: "entity_customer_categories" | "entity_supplier_categories";
  countRpc: "count_entities_by_customer_category" | "count_entities_by_supplier_category";
  saveRpc: "save_entity_customer_category" | "save_entity_supplier_category";
  deleteRpc: "delete_entity_customer_category" | "delete_entity_supplier_category";
  entityCategoryIdColumn: "customer_category_id" | "supplier_category_id";
  title: string;
  titleSingular: string;
  entityNoun: string;
  entityNounPlural: string;
  listPrefsStorageKey: string;
};

const WORKSPACE_CONFIG: Record<EntityCategoryWorkspace, EntityCategoryWorkspaceConfig> = {
  customer: {
    workspace: "customer",
    table: "entity_customer_categories",
    countRpc: "count_entities_by_customer_category",
    saveRpc: "save_entity_customer_category",
    deleteRpc: "delete_entity_customer_category",
    entityCategoryIdColumn: "customer_category_id",
    title: "Customer Categories",
    titleSingular: "Customer category",
    entityNoun: "customer",
    entityNounPlural: "customers",
    listPrefsStorageKey: "aib-entity-customer-category-list-prefs",
  },
  supplier: {
    workspace: "supplier",
    table: "entity_supplier_categories",
    countRpc: "count_entities_by_supplier_category",
    saveRpc: "save_entity_supplier_category",
    deleteRpc: "delete_entity_supplier_category",
    entityCategoryIdColumn: "supplier_category_id",
    title: "Supplier Categories",
    titleSingular: "Supplier category",
    entityNoun: "supplier",
    entityNounPlural: "suppliers",
    listPrefsStorageKey: "aib-entity-supplier-category-list-prefs",
  },
};

export function getEntityCategoryWorkspaceConfig(
  workspace: EntityCategoryWorkspace
): EntityCategoryWorkspaceConfig {
  return WORKSPACE_CONFIG[workspace];
}

export function entityCategoryPageDescription(workspace: EntityCategoryWorkspace): string {
  const { entityNounPlural } = getEntityCategoryWorkspaceConfig(workspace);
  return `Configure hierarchical ${entityNounPlural} categories and inherited attribute templates.`;
}
