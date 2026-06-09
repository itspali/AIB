import { normalizeAttributeKey } from "@/lib/categories/attribute-key";
import type { AttributeTemplateEntry } from "@/lib/categories/types";
import {
  templateEntryToEntityFieldDefinition,
  type EntityCustomFieldDefinition,
} from "@/lib/entities/custom-field-definitions";
import type { EntityWorkspace } from "@/lib/entities/types";
import { resolveEffectiveEntityCategoryAttributeTemplates } from "@/lib/entity-categories/tree";
import type { EntityCategoryRow } from "@/lib/entity-categories/types";

export function resolveEffectiveEntityFields(
  _workspace: EntityWorkspace,
  categoryId: string | null | undefined,
  categoryRows: EntityCategoryRow[],
  orgDefinitions: EntityCustomFieldDefinition[]
): EntityCustomFieldDefinition[] {
  if (!categoryId) return [];

  const effectiveTemplates = resolveEffectiveEntityCategoryAttributeTemplates(
    categoryId,
    categoryRows
  );
  if (effectiveTemplates.length === 0) return [];

  const orgByKey = new Map<string, EntityCustomFieldDefinition>();
  for (const definition of orgDefinitions) {
    orgByKey.set(normalizeAttributeKey(definition.key), definition);
  }

  const resolved: EntityCustomFieldDefinition[] = [];
  const seenKeys = new Set<string>();

  for (const template of effectiveTemplates) {
    const key = normalizeAttributeKey(template.key);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);

    const orgDefinition = orgByKey.get(key);
    const fromTemplate = templateEntryToEntityFieldDefinition(template);

    resolved.push(
      orgDefinition
        ? {
            ...orgDefinition,
            label: fromTemplate.label || orgDefinition.label,
            type: fromTemplate.type,
            required: fromTemplate.required ?? orgDefinition.required,
            options: fromTemplate.options ?? orgDefinition.options,
          }
        : fromTemplate
    );
  }

  return resolved;
}

export function effectiveEntityFieldKeys(
  workspace: EntityWorkspace,
  categoryId: string | null | undefined,
  categoryRows: EntityCategoryRow[]
): string[] {
  if (!categoryId) return [];

  return resolveEffectiveEntityCategoryAttributeTemplates(categoryId, categoryRows).map((entry) =>
    normalizeAttributeKey(entry.key)
  );
}

export type { AttributeTemplateEntry };
