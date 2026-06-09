import type { AttributeTemplateEntry } from "@/lib/categories/types";
import {
  buildCategoryTree,
  collectDescendantIds,
  collectExpandableCategoryIds,
  filterCategoryTree,
  flattenTree,
  mergeAttributeTemplates,
  parentSelectOptions,
  parseAttributeTemplates,
  resolveEffectiveAttributeTemplates,
  resolveInheritedAttributeTemplates,
  resolveLineage,
} from "@/lib/categories/tree";
import type { CategoryRow, CategoryTreeNode } from "@/lib/categories/types";
import type { EntityCategoryRow, EntityCategoryTreeNode } from "@/lib/entity-categories/types";

function asCategoryRows(rows: EntityCategoryRow[]): CategoryRow[] {
  return rows as CategoryRow[];
}

function toEntityCategoryTreeNode(node: CategoryTreeNode): EntityCategoryTreeNode {
  const { default_variant_strategy: _strategy, default_item_type: _itemType, ...row } = node;
  return {
    ...row,
    children: node.children.map(toEntityCategoryTreeNode),
    depth: node.depth,
  };
}

export function buildEntityCategoryTree(rows: EntityCategoryRow[]): EntityCategoryTreeNode[] {
  return buildCategoryTree(asCategoryRows(rows)).map(toEntityCategoryTreeNode);
}

export function resolveEntityCategoryLineage(
  categoryId: string,
  rows: EntityCategoryRow[]
): EntityCategoryRow[] {
  return resolveLineage(categoryId, asCategoryRows(rows)) as EntityCategoryRow[];
}

export {
  mergeAttributeTemplates,
  parseAttributeTemplates,
};

export function resolveEffectiveEntityCategoryAttributeTemplates(
  categoryId: string,
  rows: EntityCategoryRow[]
): AttributeTemplateEntry[] {
  return resolveEffectiveAttributeTemplates(categoryId, asCategoryRows(rows));
}

export function resolveInheritedEntityCategoryAttributeTemplates(
  categoryId: string,
  rows: EntityCategoryRow[]
): AttributeTemplateEntry[] {
  return resolveInheritedAttributeTemplates(categoryId, asCategoryRows(rows));
}

export function flattenEntityCategoryTree(nodes: EntityCategoryTreeNode[]): EntityCategoryTreeNode[] {
  return flattenTree(nodes as CategoryTreeNode[]) as EntityCategoryTreeNode[];
}

export function collectExpandableEntityCategoryIds(
  nodes: EntityCategoryTreeNode[]
): Set<string> {
  return collectExpandableCategoryIds(nodes as CategoryTreeNode[]);
}

export function filterEntityCategoryTree(
  nodes: EntityCategoryTreeNode[],
  query: string
): EntityCategoryTreeNode[] {
  return filterCategoryTree(nodes as CategoryTreeNode[], query) as EntityCategoryTreeNode[];
}

export function collectEntityCategoryDescendantIds(
  categoryId: string,
  rows: EntityCategoryRow[]
): Set<string> {
  return collectDescendantIds(categoryId, asCategoryRows(rows));
}

export function entityCategoryParentSelectOptions(
  rows: EntityCategoryRow[],
  excludeCategoryId?: string | null
): { id: string | null; label: string; depth: number }[] {
  return parentSelectOptions(asCategoryRows(rows), excludeCategoryId);
}
